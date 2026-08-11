const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { logAction } = require('./auditLogger');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID || 'ca-central-1_dBeo5yZXq';
const RESIDENT_TABLE = process.env.RESIDENT_TABLE || 'Resident';

exports.handler = async (event) => {
  console.log('UpdateResident input:', JSON.stringify(event, null, 2));
  
  try {
    const { id, email, name, phone, building, floor, unitNumber, plate } = event.arguments.input;
    
    if (!id) {
      throw new Error('Resident ID is required');
    }
    
    // Step 1: Get current resident from DynamoDB to get userId
    const getCommand = new GetCommand({
      TableName: RESIDENT_TABLE,
      Key: { id }
    });
    
    const currentResident = await docClient.send(getCommand);
    
    if (!currentResident.Item) {
      throw new Error(`Resident with ID ${id} not found`);
    }
    
    const userId = currentResident.Item.userId;
    
    // Step 2: Build DynamoDB update expression
    const now = new Date().toISOString();
    const updateExpressions = [];
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };
    const expressionAttributeValues = { ':updatedAt': now };
    
    if (email !== undefined) {
      updateExpressions.push('#email = :email');
      expressionAttributeNames['#email'] = 'email';
      expressionAttributeValues[':email'] = email;
    }
    
    if (name !== undefined) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = name;
    }
    
    if (phone !== undefined) {
      updateExpressions.push('#phone = :phone');
      expressionAttributeNames['#phone'] = 'phone';
      expressionAttributeValues[':phone'] = phone;
    }
    
    if (building !== undefined) {
      updateExpressions.push('building = :building');
      expressionAttributeValues[':building'] = building;
    }
    
    if (floor !== undefined) {
      updateExpressions.push('floor = :floor');
      expressionAttributeValues[':floor'] = floor;
    }
    
    if (unitNumber !== undefined) {
      updateExpressions.push('unitNumber = :unitNumber');
      expressionAttributeValues[':unitNumber'] = unitNumber;
    }
    
    if (plate !== undefined) {
      updateExpressions.push('plate = :plate');
      expressionAttributeValues[':plate'] = plate;
    }
    
    // Step 3: Update DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: RESIDENT_TABLE,
      Key: { id },
      UpdateExpression: 'SET #updatedAt = :updatedAt' + (updateExpressions.length > 0 ? ', ' + updateExpressions.join(', ') : ''),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const updateResult = await docClient.send(updateCommand);
    console.log('DynamoDB updated successfully');
    
    // Step 4: Sync Cognito User Attributes
    try {
      const cognitoAttributes = [];
      
      // Update email in Cognito if changed
      if (email !== undefined && email !== currentResident.Item.email) {
        cognitoAttributes.push({ Name: 'email', Value: email });
        cognitoAttributes.push({ Name: 'email_verified', Value: 'true' });
      }
      
      // Update custom attributes for quick access
      if (floor !== undefined) {
        cognitoAttributes.push({ Name: 'custom:floor', Value: floor });
      }
      
      if (plate !== undefined) {
        cognitoAttributes.push({ Name: 'custom:plate', Value: plate });
      }
      
      if (currentResident.Item.residentCode) {
        cognitoAttributes.push({ Name: 'custom:residentCode', Value: currentResident.Item.residentCode });
      }
      
      // Only update if there are attributes to update
      if (cognitoAttributes.length > 0 && userId) {
        const updateCognitoCommand = new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId,
          UserAttributes: cognitoAttributes
        });
        
        await cognitoClient.send(updateCognitoCommand);
        console.log('Cognito attributes synced successfully');
      }
    } catch (cognitoError) {
      // Log but don't fail the entire operation if Cognito sync fails
      console.error('Warning: Failed to sync Cognito attributes:', cognitoError.message);
      console.error('DynamoDB was updated successfully, but Cognito is out of sync');
      // Continue execution - DynamoDB is source of truth
    }
    
    // Audit log
    await logAction(
      'UPDATE_RESIDENT',
      updateResult.Attributes.email || currentResident.Item.email,
      {
        id,
        changes: { email, name, phone, building, floor, unitNumber, plate }
      },
      'Resident',
      id
    );
    
    return updateResult.Attributes;
    
  } catch (error) {
    console.error('Error updating resident:', error);
    throw new Error(error.message || 'Failed to update resident');
  }
};
