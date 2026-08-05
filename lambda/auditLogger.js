const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Log an action to the audit log
 * @param {string} action - Action performed (e.g., 'CREATE_RESIDENT', 'DELETE_RESERVATION')
 * @param {string} userId - User who performed the action
 * @param {object} details - Additional details about the action
 * @param {string} resourceType - Type of resource (e.g., 'Resident', 'Reservation')
 * @param {string} resourceId - ID of the resource affected
 */
async function logAction(action, userId, details, resourceType, resourceId) {
  try {
    const timestamp = new Date().toISOString();
    const id = `${action}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await docClient.send(new PutCommand({
      TableName: process.env.AUDIT_LOG_TABLE || 'AuditLog',
      Item: {
        id,
        timestamp,
        action,
        userId: userId || 'system',
        resourceType,
        resourceId,
        details: JSON.stringify(details),
        createdAt: timestamp
      }
    }));
    
    console.log(`Audit log created: ${action} by ${userId}`);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't fail the operation if audit logging fails
  }
}

module.exports = { logAction };
