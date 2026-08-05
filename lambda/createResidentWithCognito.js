const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');

const dynamoClient = new DynamoDBClient({ region: 'ca-central-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const cognitoClient = new CognitoIdentityProviderClient({ region: 'ca-central-1' });

const USER_POOL_ID = 'ca-central-1_dBeo5yZXq';

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

// Generate unique resident code (6 characters: 3 letters + 3 numbers)
async function generateUniqueResidentCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  
  let attempts = 0;
  const maxAttempts = 10;
  
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
    
    // Check if code already exists in database
    const scanCommand = new ScanCommand({
      TableName: 'Resident',
      FilterExpression: 'residentCode = :code',
      ExpressionAttributeValues: {
        ':code': code
      },
      Limit: 1
    });
    
    const result = await docClient.send(scanCommand);
    
    if (!result.Items || result.Items.length === 0) {
      // Code is unique!
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique resident code after multiple attempts');
}

exports.handler = async (event) => {
  console.log('CreateResidentWithCognito input:', JSON.stringify(event, null, 2));
  
  try {
    const { email, building, floor, unitNumber, plate } = event.arguments.input;
    
    // Validate required fields
    if (!email || !floor || !plate || !building || !unitNumber) {
      throw new Error('Missing required fields: email, building, floor, unitNumber, plate');
    }
    
    // Generate unique resident ID
    const residentId = `resident_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Generate unique resident code (backend ensures uniqueness)
    const residentCode = await generateUniqueResidentCode();
    console.log(`Generated unique resident code: ${residentCode}`);
    
    // Generate temporary password
    const tempPassword = generateTempPassword();
    
    console.log(`Creating Cognito user for email: ${email}`);
    
    // Step 1: Create Cognito User
    let cognitoUserId;
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
        MessageAction: 'SUPPRESS', // Don't send welcome email automatically
        DesiredDeliveryMediums: ['EMAIL'],
      });
      
      const createUserResponse = await cognitoClient.send(createUserCommand);
      cognitoUserId = createUserResponse.User.Username;
      
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
      
      // Handle specific error cases
      if (cognitoError.name === 'UsernameExistsException') {
        throw new Error(`A user with email ${email} already exists`);
      }
      
      throw new Error(`Failed to create Cognito user: ${cognitoError.message}`);
    }
    
    // Step 3: Create Resident in DynamoDB
    const now = new Date().toISOString();
    const resident = {
      id: residentId,
      email: email,
      building: building,
      floor: floor,
      unitNumber: unitNumber,
      plate: plate,
      residentCode: residentCode, // Backend-generated unique code
      userId: cognitoUserId,
      createdAt: now,
      updatedAt: now,
    };
    
    const putCommand = new PutCommand({
      TableName: 'Resident',
      Item: resident,
    });
    
    await docClient.send(putCommand);
    console.log(`Resident created in DynamoDB: ${residentId} with code: ${residentCode}`);
    
    // Return success with temp password and resident code
    return {
      ...resident,
      tempPassword: tempPassword, // Return temp password so admin can give it to resident
      message: `Resident created successfully. Code: ${residentCode}, Password: ${tempPassword}`,
    };
    
  } catch (error) {
    console.error('Error:', error);
    throw new Error(error.message || 'Failed to create resident');
  }
};
