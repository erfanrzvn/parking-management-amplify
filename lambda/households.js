const { randomInt } = require('node:crypto');
const { GetCommand, ScanCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');

const normalize = value => String(value ?? '').normalize('NFKC').trim().toUpperCase();
function householdKey({ building, unitNumber }) {
  if (!normalize(building) || !normalize(unitNumber)) throw new Error('Building and unit number are required');
  return JSON.stringify([normalize(building), normalize(unitNumber)]);
}
function generateCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}
async function scanAll(client, input) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await client.send(new ScanCommand({ ...input, ExclusiveStartKey }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// Separate registry: conditional transaction protects both the address and code
// across concurrent manual creates and CSV imports. Never accept a caller's code.
async function resolveHouseholdCode(client, address) {
  const TableName = process.env.HOUSEHOLD_TABLE;
  if (!TableName) throw new Error('HOUSEHOLD_TABLE must be configured before creating residents');
  const addressKey = householdKey(address);
  const Key = { id: `address:${addressKey}` };
  const existing = await client.send(new GetCommand({ TableName, Key, ConsistentRead: true }));
  if (existing.Item) return existing.Item.code;

  const residents = await scanAll(client, { TableName: process.env.RESIDENT_TABLE || 'Resident', ConsistentRead: true });
  const members = residents.filter(r => !r.deletedAt && r.building && r.unitNumber && householdKey(r) === addressKey);
  const existingCodes = [...new Set(members.map(r => /^[A-Z0-9]{6}$/.test(normalize(r.householdId)) ? normalize(r.householdId) : normalize(r.residentCode)).filter(c => /^[A-Z0-9]{6}$/.test(c)))];
  if (existingCodes.length > 1) throw new Error('Household has conflicting legacy codes; reconcile its data before adding members');
  const preferred = existingCodes[0];
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = preferred || generateCode();
    if (residents.some(r => (normalize(r.householdId) === code || normalize(r.residentCode) === code) && (!r.building || !r.unitNumber || householdKey(r) !== addressKey))) {
      if (preferred) throw new Error('Household code belongs to multiple addresses; data reconciliation required');
      continue;
    }
    try {
      await client.send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName, Item: { ...Key, code }, ConditionExpression: 'attribute_not_exists(id)' } },
        { Put: { TableName, Item: { id: `code:${code}`, addressKey }, ConditionExpression: 'attribute_not_exists(id)' } },
      ] }));
      return code;
    } catch (error) {
      if (error.name !== 'TransactionCanceledException') throw error;
      const winner = await client.send(new GetCommand({ TableName, Key, ConsistentRead: true }));
      if (winner.Item) return winner.Item.code;
      if (preferred) throw error;
    }
  }
  throw new Error('Unable to allocate a household code; please retry');
}
module.exports = { normalize, householdKey, generateCode, scanAll, resolveHouseholdCode };
