const { randomUUID } = require('node:crypto');
const { PutCommand, DeleteCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');

// Every reservation/config write must use this lock. The commit checks the
// fencing token, so an expired holder cannot write after another request wins.
async function withReservationLock(client, work) {
  const TableName = process.env.HOUSEHOLD_TABLE;
  if (!TableName) throw new Error('HOUSEHOLD_TABLE is required');
  const id = 'lock:reservations', token = randomUUID();
  const now = Date.now();
  try {
    await client.send(new PutCommand({ TableName, Item: { id, token, expiresAt: now + 60000 },
      ConditionExpression: 'attribute_not_exists(id) OR expiresAt < :now', ExpressionAttributeValues: { ':now': now } }));
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') throw new Error('Another booking is being processed; please retry');
    throw error;
  }
  try {
    return await work(async writes => client.send(new TransactWriteCommand({ TransactItems: [
      { ConditionCheck: { TableName, Key: { id }, ConditionExpression: '#token = :token AND expiresAt > :now',
        ExpressionAttributeNames: { '#token': 'token' }, ExpressionAttributeValues: { ':token': token, ':now': Date.now() } } },
      ...writes,
    ] })));
  } finally {
    try { await client.send(new DeleteCommand({ TableName, Key: { id }, ConditionExpression: '#token = :token',
      ExpressionAttributeNames: { '#token': 'token' }, ExpressionAttributeValues: { ':token': token } })); }
    catch (error) { console.error('Booking lock release failed', error.name); }
  }
}
module.exports = { withReservationLock };
