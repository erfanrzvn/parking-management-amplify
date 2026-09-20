import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminGetUserCommand, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';
import { randomBytes } from 'crypto';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ca-central-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ca-central-1' });

const RESIDENT_TABLE = process.env.RESIDENT_TABLE || 'Resident';
const USER_POOL_ID = process.env.USER_POOL_ID || 'ca-central-1_dBeo5yZXq';

/**
 * Generate householdId from building, floor, and unitNumber
 */
function generateHouseholdId(building, floor, unitNumber) {
  return `${building}-${floor}-${unitNumber}`.replace(/\s+/g, '');
}

/**
 * Generate a random 6-character alphanumeric resident code
 */
function generateResidentCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Parse CSV string into array of objects
 */
function parseCSV(csvData) {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const requiredHeaders = ['email', 'building', 'floor', 'unitNumber', 'plate'];
  
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      throw new Error(`CSV must contain required column: ${required}`);
    }
  }

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas
    const values = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        if (insideQuotes && line[j + 1] === '"') {
          currentValue += '"';
          j++; // Skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Add last value

    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    records.push(record);
  }

  return records;
}

/**
 * Check if user exists in Cognito
 */
async function checkCognitoUser(email) {
  try {
    const result = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email
    }));
    return result;
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return null;
    }
    throw error;
  }
}

/**
 * Create or update Cognito user
 */
async function createOrUpdateCognitoUser(resident, isUpdate = false) {
  const { email, name, phone } = resident;

  if (isUpdate) {
    // Update existing user
    const attributes = [];
    if (name) attributes.push({ Name: 'name', Value: name });
    if (phone) attributes.push({ Name: 'phone_number', Value: phone });

    if (attributes.length > 0) {
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: attributes
      }));
    }
    
    const userInfo = await checkCognitoUser(email);
    return userInfo.Username;
  } else {
    // Create new user
    const userAttributes = [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' }
    ];
    if (name) userAttributes.push({ Name: 'name', Value: name });
    if (phone) userAttributes.push({ Name: 'phone_number', Value: phone });

    const createResult = await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: userAttributes,
      MessageAction: 'SUPPRESS', // Don't send welcome email during bulk import
      DesiredDeliveryMediums: ['EMAIL']
    }));

    // Add to RESIDENT group
    try {
      await cognitoClient.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: 'RESIDENT'
      }));
    } catch (error) {
      console.warn(`Could not add user to RESIDENT group: ${error.message}`);
    }

    return createResult.User.Username;
  }
}

/**
 * Check if resident exists in DynamoDB by email
 */
async function getResidentByEmail(email) {
  const scanParams = {
    TableName: RESIDENT_TABLE,
    FilterExpression: 'email = :email AND attribute_not_exists(deletedAt)',
    ExpressionAttributeValues: {
      ':email': email
    }
  };

  const result = await docClient.send(new ScanCommand(scanParams));
  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Import residents from CSV
 */
export const handler = async (event) => {
  console.log('Import residents CSV request');

  try {
    // Get CSV data from GraphQL args
    const csvData = event.arguments?.csvData;
    if (!csvData) {
      throw new Error('csvData is required');
    }

    // Parse CSV
    const records = parseCSV(csvData);
    console.log(`Parsed ${records.length} records from CSV`);

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Validate required fields
        if (!record.email || !record.building || !record.floor || !record.unitNumber || !record.plate) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: Missing required fields (email, building, floor, unitNumber, plate)`);
          continue;
        }

        // Generate householdId
        const householdId = generateHouseholdId(record.building, record.floor, record.unitNumber);

        // Check if resident exists
        const existingResident = record.id 
          ? await getResidentById(record.id)
          : await getResidentByEmail(record.email);

        const now = new Date().toISOString();

        if (existingResident) {
          // Update existing resident
          console.log(`Updating resident: ${record.email}`);

          // Update Cognito user
          await createOrUpdateCognitoUser(record, true);

          // Update DynamoDB
          const updateExpression = [];
          const expressionAttributeNames = {};
          const expressionAttributeValues = {};

          if (record.name) {
            updateExpression.push('#name = :name');
            expressionAttributeNames['#name'] = 'name';
            expressionAttributeValues[':name'] = record.name;
          }
          if (record.phone) {
            updateExpression.push('phone = :phone');
            expressionAttributeValues[':phone'] = record.phone;
          }
          if (record.building) {
            updateExpression.push('building = :building');
            expressionAttributeValues[':building'] = record.building;
          }
          if (record.floor) {
            updateExpression.push('floor = :floor');
            expressionAttributeValues[':floor'] = record.floor;
          }
          if (record.unitNumber) {
            updateExpression.push('unitNumber = :unitNumber');
            expressionAttributeValues[':unitNumber'] = record.unitNumber;
          }
          if (record.plate) {
            updateExpression.push('plate = :plate');
            expressionAttributeValues[':plate'] = record.plate;
          }

          updateExpression.push('householdId = :householdId');
          expressionAttributeValues[':householdId'] = householdId;

          updateExpression.push('updatedAt = :updatedAt');
          expressionAttributeValues[':updatedAt'] = now;

          await docClient.send(new UpdateItemCommand({
            TableName: RESIDENT_TABLE,
            Key: { id: existingResident.id },
            UpdateExpression: 'SET ' + updateExpression.join(', '),
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: expressionAttributeValues
          }));

          results.updated++;
        } else {
          // Create new resident
          console.log(`Creating new resident: ${record.email}`);

          // Create Cognito user
          const userId = await createOrUpdateCognitoUser(record, false);

          // Generate resident code if not provided
          const residentCode = record.residentCode || generateResidentCode();

          // Create in DynamoDB
          const residentId = record.id || `resident_${Date.now()}_${randomBytes(3).toString('hex')}`;
          
          await docClient.send(new PutItemCommand({
            TableName: RESIDENT_TABLE,
            Item: {
              id: residentId,
              email: record.email,
              name: record.name || '',
              phone: record.phone || '',
              building: record.building,
              floor: record.floor,
              unitNumber: record.unitNumber,
              plate: record.plate,
              residentCode: residentCode,
              userId: userId,
              householdId: householdId,
              createdAt: now,
              updatedAt: now
            }
          }));

          results.created++;
        }
      } catch (error) {
        console.error(`Error processing row ${i + 2}:`, error);
        results.failed++;
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    const message = `Import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`;
    console.log(message);

    return {
      success: results.failed === 0,
      created: results.created,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors.slice(0, 20), // Limit to first 20 errors
      message: message
    };

  } catch (error) {
    console.error('Error importing residents:', error);
    throw new Error(`Failed to import residents: ${error.message}`);
  }
};

/**
 * Helper function to get resident by ID
 */
async function getResidentById(id) {
  const result = await docClient.send(new GetItemCommand({
    TableName: RESIDENT_TABLE,
    Key: { id }
  }));
  return result.Item;
}
