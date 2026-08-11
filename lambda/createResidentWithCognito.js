const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { logAction } = require('./auditLogger');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID || 'ca-central-1_dBeo5yZXq';

// Generate random temporary password (meets Cognito requirements)
function generateTempPassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Add more random characters to reach 12 characters
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Generate unique resident code using Query on GSI (not Scan!)
async function generateUniqueResidentCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  
  let attempts = 0;
  const maxAttempts = 20;
  
  while (attempts < maxAttempts) {
    let code = '';
    
    // 3 letters
    for (let i = 0; i < 3; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // 3 numbers
    for (let i = 0; i < 3; i++) {
      code += nums[Math.floor(Math.random() * nums.length)];
    }
    
    // Check if code exists using Query on GSI (not Scan!)
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const queryCommand = new QueryCommand({
      TableName: process.env.RESIDENT_TABLE || 'Resident',
      IndexName: 'byResidentCode',
      KeyConditionExpression: 'residentCode = :code',
      ExpressionAttributeValues: {
        ':code': code
      },
      Limit: 1
    });
    
    const result = await docClient.send(queryCommand);
    
    if (!result.Items || result.Items.length === 0) {
      // Code is unique!
      return code;
    }
    
    attempts++;
    console.log(`Code ${code} already exists, retrying... (attempt ${attempts}/${maxAttempts})`);
  }
  
  throw new Error('Failed to generate unique resident code after multiple attempts');
}

exports.handler = async (event) => {
  console.log('CreateResidentWithCognito input:', JSON.stringify(event, null, 2));
  
  let cognitoUserId = null;
  let rollbackCognito = false;
  
  try {
    const { email, name, phone, building, floor, unitNumber, plate } = event.arguments.input;
    
    // Validate required fields
    if (!email || !floor || !plate || !building || !unitNumber) {
      throw new Error('Missing required fields');
    }
    
    // Generate unique resident ID
    const residentId = `resident_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Generate unique resident code
    const residentCode = await generateUniqueResidentCode();
    console.log(`Generated unique resident code: ${residentCode}`);
    
    // Generate temporary password
    const tempPassword = generateTempPassword();
    
    console.log(`Creating Cognito user for email: ${email}`);
    
    // Step 1: Create Cognito User
    try {
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:userType', Value: 'RESIDENT' },
          { Name: 'custom:floor', Value: floor },
          { Name: 'custom:plate', Value: plate },
          { Name: 'custom:residentCode', Value: residentCode },
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS',
        DesiredDeliveryMediums: ['EMAIL'],
      });
      
      const createUserResponse = await cognitoClient.send(createUserCommand);
      cognitoUserId = createUserResponse.User.Username;
      rollbackCognito = true; // Mark for rollback if subsequent steps fail
      
      console.log(`Cognito user created: ${cognitoUserId}`);
      
      // Step 2: Add user to RESIDENT group
      const addToGroupCommand = new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: cognitoUserId,
        GroupName: 'RESIDENT',
      });
      
      await cognitoClient.send(addToGroupCommand);
      console.log(`User added to RESIDENT group`);
      
    } catch (cognitoError) {
      console.error('Cognito error:', cognitoError);
      
      if (cognitoError.name === 'UsernameExistsException') {
        throw new Error(`User with email ${email} already exists`);
      }
      
      throw new Error(`Failed to create user: ${cognitoError.message}`);
    }
    
    // Step 3: Create Resident in DynamoDB with transaction safety
    const now = new Date().toISOString();
    const resident = {
      id: residentId,
      email: email,
      name: name,
      phone: phone,
      building: building,
      floor: floor,
      unitNumber: unitNumber,
      plate: plate,
      residentCode: residentCode,
      userId: cognitoUserId,
      createdAt: now,
      updatedAt: now,
    };
    
    const putCommand = new PutCommand({
      TableName: process.env.RESIDENT_TABLE || 'Resident',
      Item: resident,
      // Conditional write: fail if residentCode already exists
      ConditionExpression: 'attribute_not_exists(residentCode)',
    });
    
    try {
      await docClient.send(putCommand);
      console.log(`Resident created in DynamoDB: ${residentId} with code: ${residentCode}`);
    } catch (dbError) {
      console.error('DynamoDB error:', dbError);
      
      // ROLLBACK: Delete Cognito user since DynamoDB write failed
      if (rollbackCognito && cognitoUserId) {
        console.log(`Rolling back: Deleting Cognito user ${cognitoUserId}`);
        try {
          await cognitoClient.send(new AdminDeleteUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: cognitoUserId
          }));
          console.log(`Rollback successful: Cognito user deleted`);
        } catch (rollbackError) {
          console.error(`Rollback failed: ${rollbackError.message}`);
          // Log for manual cleanup but still throw original error
        }
      }
      
      if (dbError.name === 'ConditionalCheckFailedException') {
        throw new Error(`Resident code ${residentCode} already exists. Please try again.`);
      }
      throw new Error('Failed to create resident record');
    }
    
    // Validation: email format
    if (!email.includes('@') || !email.includes('.')) {
      throw new Error('Invalid email format');
    }
    
    // Audit log
    await logAction(
      'CREATE_RESIDENT',
      email,
      {
        email,
        building,
        floor,
        unitNumber,
        plate
      },
      'Resident',
      residentId
    );
    
    // Return success
    return {
      ...resident,
      tempPassword: tempPassword,
      message: `Resident created successfully`,
    };
    
  } catch (error) {
    console.error('Error:', error);
    
    // Sanitize error message (don't expose internal details)
    const message = error.message || 'Failed to create resident';
    throw new Error(message);
  }
};
