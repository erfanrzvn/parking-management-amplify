const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminDisableUserCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { logAction } = require('./auditLogger');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID || 'ca-central-1_dBeo5yZXq';
const RESIDENT_TABLE = process.env.RESIDENT_TABLE || 'Resident';

exports.handler = async (event) => {
  console.log('DeleteResident input:', JSON.stringify(event, null, 2));
  
  try {
    const { id } = event.arguments;
    
    if (!id) {
      throw new Error('Resident ID is required');
    }
    
    // Step 1: Get resident from DynamoDB to get userId
    const getCommand = new GetCommand({
      TableName: RESIDENT_TABLE,
      Key: { id }
    });
    
    const resident = await docClient.send(getCommand);
    
    if (!resident.Item) {
      throw new Error(`Resident with ID ${id} not found`);
    }
    
    const userId = resident.Item.userId;
    const email = resident.Item.email;
    
    // Step 2: Soft delete in DynamoDB (set deletedAt timestamp)
    const now = new Date().toISOString();
    const updateCommand = new UpdateCommand({
      TableName: RESIDENT_TABLE,
      Key: { id },
      UpdateExpression: 'SET deletedAt = :deletedAt, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':deletedAt': now,
        ':updatedAt': now
      },
      ReturnValues: 'ALL_NEW'
    });
    
    const updateResult = await docClient.send(updateCommand);
    console.log('Resident soft-deleted in DynamoDB');
    
    // Step 3: Disable Cognito user (soft delete - can be re-enabled)
    // Option: Use AdminDisableUserCommand (user can't login but data remains)
    // Option: Use AdminDeleteUserCommand (permanent delete)
    
    try {
      if (userId) {
        // Soft delete in Cognito - just disable the user
        const disableUserCommand = new AdminDisableUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId
        });
        
        await cognitoClient.send(disableUserCommand);
        console.log('Cognito user disabled successfully');
        
        // If you want hard delete in Cognito, uncomment below:
        /*
        const deleteUserCommand = new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId
        });
        await cognitoClient.send(deleteUserCommand);
        console.log('Cognito user deleted successfully');
        */
      }
    } catch (cognitoError) {
      // Log but don't fail if Cognito operation fails
      console.error('Warning: Failed to disable Cognito user:', cognitoError.message);
      console.error('DynamoDB was updated successfully, but Cognito user remains active');
      // Continue execution - DynamoDB is source of truth
    }
    
    // Audit log
    await logAction(
      'DELETE_RESIDENT',
      email,
      {
        id,
        email,
        deletedAt: now
      },
      'Resident',
      id
    );
    
    return {
      id: updateResult.Attributes.id,
      deletedAt: updateResult.Attributes.deletedAt
    };
    
  } catch (error) {
    console.error('Error deleting resident:', error);
    throw new Error(error.message || 'Failed to delete resident');
  }
};
