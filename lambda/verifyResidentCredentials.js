const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { normalize, scanAll } = require('./households');
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
exports.handler = async event => {
  const now = Math.floor(Date.now() / 1000), window = Math.floor(now / 900);
  const source = event.identity?.sourceIp;
  const ip = (Array.isArray(source) ? source.at(-1) : source) || event.request?.headers?.['x-forwarded-for']?.split(',').at(-1)?.trim();
  if (!ip) throw new Error('Unable to identify request source');
  if (!process.env.RATE_LIMIT_TABLE) throw new Error('Rate limiting is not configured');
  try {
    await client.send(new UpdateCommand({
      TableName: process.env.RATE_LIMIT_TABLE, Key: { key: `verify:${ip}:${window}` },
      UpdateExpression: 'SET #ttl = :ttl ADD attempts :one',
      ConditionExpression: 'attribute_not_exists(attempts) OR attempts < :max',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':ttl': (window + 1) * 900, ':one': 1, ':max': 5 },
    }));
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') throw new Error('Too many attempts. Try again later.');
    throw new Error('Verification temporarily unavailable');
  }
  const { residentCode, unitNumber } = event.arguments;
  const code = normalize(residentCode), unit = normalize(unitNumber);
  let resident;
  if (/^[A-Z0-9]{6}$/.test(code) && unit) {
    resident = (await scanAll(client, { TableName: process.env.RESIDENT_TABLE || 'Resident', ConsistentRead: true }))
      .find(r => !r.deletedAt && r.building && r.unitNumber && (normalize(r.householdId) === code || normalize(r.residentCode) === code) && normalize(r.unitNumber) === unit);
  }
  return { isValid: !!resident, residentId: resident?.id || null,
    residentFloor: null, residentPlate: null,
    message: resident ? 'Verified successfully' : 'Invalid resident code or unit number' };
};
