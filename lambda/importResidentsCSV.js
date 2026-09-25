const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { scanAll } = require('./households');
const { requireAdmin } = require('./access');
const { parseCSV } = require('./csv');
const { handler: create } = require('./createResidentWithCognito');
const { handler: update } = require('./updateResident');
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
exports.handler = async event => {
  requireAdmin(event);
  const records = parseCSV(event.arguments.csvData);
  const residents = await scanAll(client, { TableName: process.env.RESIDENT_TABLE || 'Resident', ConsistentRead: true });
  const byEmail = new Map(residents.filter(r => !r.deletedAt).map(r => [r.email.trim().toLowerCase(), r]));
  const result = { created: 0, updated: 0, failed: 0, errors: [], credentials: [] };
  for (const [index, row] of records.entries()) {
    try {
      // Import and manual creation share validation, code allocation and rollback.
      const input = Object.fromEntries(['email','name','phone','building','floor','unitNumber','plate'].map(k => [k, row[k] || '']));
      input.email = input.email.trim().toLowerCase();
      const current = byEmail.get(input.email);
      const resident = current
        ? await update({ ...event, arguments: { input: { ...input, id: current.id } } })
        : await create({ ...event, arguments: { input } });
      byEmail.set(input.email, resident);
      result[current ? 'updated' : 'created']++;
      if (!current) result.credentials.push({ email: resident.email, residentCode: resident.householdId, tempPassword: resident.tempPassword });
    } catch (error) {
      result.failed++;
      result.errors.push(`Row ${index + 2}: ${error.message}`);
    }
  }
  return { ...result, errors: result.errors.slice(0, 20), success: result.failed === 0,
    message: `Import completed: ${result.created} created, ${result.updated} updated, ${result.failed} failed. Download the new account credentials and share them with each resident.` };
};
