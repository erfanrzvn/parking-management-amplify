const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Rate limit: 5 attempts per IP per 15 minutes
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 900; // 15 minutes

// Extract IP from AppSync context
const getClientIP = (ctx) => {
  return ctx?.request?.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || ctx?.request?.headers['x-real-ip'] 
    || ctx?.identity?.sourceIp 
    || 'unknown';
};

const checkRateLimit = async (key) => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + WINDOW_SECONDS;
  
  try {
    // Try to get existing rate limit record
    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.RATE_LIMIT_TABLE,
      Key: { key }
    }));
    
    if (getResult.Item) {
      const attempts = getResult.Item.attempts || 0;
      const expiresAt = getResult.Item.ttl || 0;
      
      // Check if window has expired
      if (expiresAt < now) {
        // Reset counter
        await docClient.send(new PutCommand({
          TableName: process.env.RATE_LIMIT_TABLE,
          Item: {
            key,
            attempts: 1,
            ttl,
            lastAttempt: now
          }
        }));
        return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
      }
      
      // Check if exceeded
      if (attempts >= MAX_ATTEMPTS) {
        const resetIn = expiresAt - now;
        return { 
          allowed: false, 
          remaining: 0,
          resetIn 
        };
      }
      
      // Increment counter
      await docClient.send(new UpdateCommand({
        TableName: process.env.RATE_LIMIT_TABLE,
        Key: { key },
        UpdateExpression: 'SET attempts = attempts + :inc, lastAttempt = :now',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':now': now
        }
      }));
      
      return { allowed: true, remaining: MAX_ATTEMPTS - attempts - 1 };
    } else {
      // First attempt
      await docClient.send(new PutCommand({
        TableName: process.env.RATE_LIMIT_TABLE,
        Item: {
          key,
          attempts: 1,
          ttl,
          lastAttempt: now
        }
      }));
      return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
    }
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request (fail open)
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
};

exports.handler = async (event) => {
  console.log('VerifyResidentCredentials request received');
  
  try {
    const { residentCode, unitNumber } = event.arguments;
    const clientIP = getClientIP(event);
    
    // Rate limiting key: IP address + action
    const rateLimitKey = `verify:${clientIP}`;
    
    // Check rate limit
    const rateLimit = await checkRateLimit(rateLimitKey);
    
    if (!rateLimit.allowed) {
      const minutes = Math.ceil(rateLimit.resetIn / 60);
      throw new Error(`Too many attempts. Please try again in ${minutes} minute(s).`);
    }
    
    // Query using GSI byResidentCode
    const queryResult = await docClient.send(new QueryCommand({
      TableName: process.env.RESIDENT_TABLE,
      IndexName: 'byResidentCode',
      KeyConditionExpression: 'residentCode = :code',
      FilterExpression: 'unitNumber = :unit AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':code': residentCode.toUpperCase(),
        ':unit': unitNumber
      }
    }));
    
    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        isValid: false,
        residentId: null,
        residentFloor: null,
        residentPlate: null,
        message: 'Invalid resident code or unit number'
      };
    }
    
    const resident = queryResult.Items[0];
    
    return {
      isValid: true,
      residentId: resident.id,
      residentFloor: resident.floor || 'N/A',
      residentPlate: resident.plate || 'N/A',
      message: 'Verified successfully'
    };
    
  } catch (error) {
    console.error('Error:', error);
    throw new Error(error.message || 'Verification failed');
  }
};
