// Run during a maintenance window with resident/reservation writes disabled.
// Default is read-only. --apply writes the reviewed plan after saving a backup.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../lambda/api.js'));
const { DynamoDBClient } = local('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, TransactWriteCommand } = local('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = local('@aws-sdk/client-cognito-identity-provider');
const { scanAll, householdKey, generateCode, normalize } = require('../lambda/households');

async function main() {
  for (const key of ['AWS_REGION','HOUSEHOLD_TABLE','RESIDENT_TABLE','RESERVATION_TABLE','USER_POOL_ID']) {
    if (!process.env[key]) throw new Error(`${key} must be set explicitly`);
  }
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const cognito = new CognitoIdentityProviderClient({});
  const residents = await scanAll(client, { TableName: process.env.RESIDENT_TABLE, ConsistentRead: true });
  const reservations = await scanAll(client, { TableName: process.env.RESERVATION_TABLE, ConsistentRead: true });
  const registry = await scanAll(client, { TableName: process.env.HOUSEHOLD_TABLE, ConsistentRead: true });
  const groups = new Map(), occupied = new Map(), addresses = new Map();
  for (const row of registry) {
    if (row.id.startsWith('code:')) occupied.set(row.id.slice(5), row.addressKey);
    if (row.id.startsWith('address:')) addresses.set(row.id.slice(8), row.code);
  }
  const accountById = new Map();
  const skipped = [];
  for (const resident of residents.filter(r => !r.deletedAt)) {
    if (!resident.building || !resident.unitNumber) { skipped.push({ id: resident.id, reason: 'Missing building or unit' }); continue; }
    for (const field of ['email','createdAt','updatedAt']) {
      if (!resident[field]) throw new Error(`Resident ${resident.id} is missing ${field}; repair before migration`);
    }
    let user;
    for (const Username of [...new Set([resident.cognitoUsername, resident.userId, resident.email].filter(Boolean))]) {
      try { user = await cognito.send(new AdminGetUserCommand({ UserPoolId: process.env.USER_POOL_ID, Username })); break; }
      catch (error) { if (error.name !== 'UserNotFoundException') throw error; }
    }
    const sub = user?.UserAttributes.find(a => a.Name === 'sub')?.Value;
    if (sub) accountById.set(resident.id, { userId: sub, cognitoUsername: user.Username });
    else {
      skipped.push({ id: resident.id, reason: 'No Cognito account; code normalized but account requires repair' });
      accountById.set(resident.id, { userId: resident.userId, cognitoUsername: resident.cognitoUsername || resident.email });
    }
    const key = householdKey(resident);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(resident);
  }
  const plan = [], byResident = new Map();
  for (const [address, members] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const weighted = new Map();
    for (const member of members) for (const [raw, weight] of [[member.householdId, 100], [member.residentCode, 1]]) {
      const candidate = normalize(raw);
      if (/^[A-Z0-9]{6}$/.test(candidate)) weighted.set(candidate, (weighted.get(candidate) || 0) + weight);
    }
    const candidates = [...weighted].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
    let code = addresses.get(address) || candidates.find(c => !occupied.has(c) || occupied.get(c) === address);
    if (code && occupied.has(code) && occupied.get(code) !== address) throw new Error('Registry conflict requires manual recovery');
    while (!code || (occupied.has(code) && occupied.get(code) !== address)) code = generateCode();
    occupied.set(code, address);
    members.forEach(r => byResident.set(r.id, code));
    if (members.length > 98) throw new Error('Household exceeds migration transaction limit');
    plan.push({ address, code, residentIds: members.map(r => r.id) });
  }
  const backupDir = path.resolve(__dirname, '../build/backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'before.json'), JSON.stringify({ residents, reservations, registry }, null, 2));
  fs.writeFileSync(path.join(backupDir, 'plan.json'), JSON.stringify(plan, null, 2));
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'read-only', households: plan.length, activeResidents: byResident.size, skipped, backupDir }));
  if (!process.argv.includes('--apply')) return;
  for (const group of plan) {
    const TableName = process.env.HOUSEHOLD_TABLE;
    const writes = [
      { Put: { TableName, Item: { id: `address:${group.address}`, code: group.code }, ConditionExpression: 'attribute_not_exists(id) OR code = :code', ExpressionAttributeValues: { ':code': group.code } } },
      { Put: { TableName, Item: { id: `code:${group.code}`, addressKey: group.address }, ConditionExpression: 'attribute_not_exists(id) OR addressKey = :address', ExpressionAttributeValues: { ':address': group.address } } },
      ...group.residentIds.map(id => {
        const old = residents.find(r => r.id === id), account = accountById.get(id);
        return { Update: { TableName: process.env.RESIDENT_TABLE, Key: { id },
          UpdateExpression: 'SET householdId = :code, residentCode = :code, userId = :sub, cognitoUsername = :username, updatedAt = :now',
          ConditionExpression: 'updatedAt = :before AND attribute_not_exists(deletedAt)',
          ExpressionAttributeValues: { ':code': group.code, ':sub': account.userId, ':username': account.cognitoUsername, ':now': new Date().toISOString(), ':before': old.updatedAt } } };
      }),
    ];
    await client.send(new TransactWriteCommand({ TransactItems: writes }));
  }
  // Only active bookings are relinked; historical audit codes remain unchanged.
  for (const reservation of reservations.filter(r => !r.deletedAt && String(r.status).toUpperCase() !== 'CANCELLED' && Date.parse(r.endTime) > Date.now() && byResident.has(r.residentId))) {
    await client.send(new TransactWriteCommand({ TransactItems: [{ Update: {
      TableName: process.env.RESERVATION_TABLE, Key: { id: reservation.id },
      UpdateExpression: 'SET householdId = :code, residentCode = :code',
      ConditionExpression: 'endTime = :end AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: { ':code': byResident.get(reservation.residentId), ':end': reservation.endTime },
    } }] }));
  }
  console.log('Migration completed. Verify counts and run live API tests before reopening writes.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
