const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildSchema, parse, validate } = require('graphql');
const { createRequire } = require('node:module');
const lambdaRequire = createRequire(require('node:path').resolve('lambda/api.js'));
const lambdaSdk = lambdaRequire('@aws-sdk/lib-dynamodb');
const lambdaCognito = lambdaRequire('@aws-sdk/client-cognito-identity-provider');
process.env.RESIDENT_TABLE = 'Resident';
process.env.RESERVATION_TABLE = 'Reservation';
process.env.PARKING_CONFIG_TABLE = 'ParkingConfig';
process.env.HOUSEHOLD_TABLE = 'HouseholdRegistry';
process.env.RATE_LIMIT_TABLE = 'RateLimit';
let db, cognitoCalls, failCognitoGroup, failResidentPut, scanSize;
const clone = value => value === undefined ? undefined : structuredClone(value);
const items = table => db[table] ||= new Map();
const key = value => value.id ?? value.key;
function check(input) {
  const current = items(input.TableName).get(key(input.Key || input.Item));
  const c = input.ConditionExpression || '', values = input.ExpressionAttributeValues || {};
  let valid = true;
  if (c === 'attribute_not_exists(id)') valid = !current;
  if (c.includes('OR expiresAt')) valid = !current || current.expiresAt < values[':now'];
  if (c.includes('#token')) valid = current?.token === values[':token'] && (!c.includes('expiresAt >') || current.expiresAt > values[':now']);
  if (c.includes('attempts <')) valid = !current || current.attempts < values[':max'];
  if (c.includes('attribute_exists(id)')) valid = !!current && (!c.includes('attribute_not_exists(deletedAt)') || !current.deletedAt);
  if (!valid) throw Object.assign(new Error('Conditional check failed'), { name: 'ConditionalCheckFailedException' });
}
async function send(command) {
  const x = command.input, name = command.constructor.name;
  if (name === 'GetCommand') return { Item: clone(items(x.TableName).get(key(x.Key))) };
  if (name === 'ScanCommand') {
    const rows = [...items(x.TableName).values()];
    const start = x.ExclusiveStartKey ? rows.findIndex(r => key(r) === key(x.ExclusiveStartKey)) + 1 : 0;
    const page = rows.slice(start, start + (x.Limit || scanSize));
    const filtered = x.FilterExpression?.includes('attribute_not_exists(deletedAt)') ? page.filter(r => !r.deletedAt) : page;
    return { Items: clone(filtered), LastEvaluatedKey: start + page.length < rows.length ? { id: page.at(-1).id } : undefined };
  }
  if (name === 'TransactWriteCommand') {
    try { x.TransactItems.forEach(op => check(Object.values(op)[0])); }
    catch (error) { throw Object.assign(error, { name: 'TransactionCanceledException' }); }
    for (const op of x.TransactItems) {
      if (op.Put) items(op.Put.TableName).set(key(op.Put.Item), clone(op.Put.Item));
      if (op.Delete) items(op.Delete.TableName).delete(key(op.Delete.Key));
    }
    return {};
  }
  check(x);
  if (name === 'PutCommand') {
    if (failResidentPut && x.TableName === 'Resident') throw new Error('Simulated database failure');
    items(x.TableName).set(key(x.Item), clone(x.Item)); return {};
  }
  if (name === 'DeleteCommand') { items(x.TableName).delete(key(x.Key)); return {}; }
  if (name === 'UpdateCommand') {
    const row = clone(items(x.TableName).get(key(x.Key)) || x.Key);
    const values = x.ExpressionAttributeValues;
    if (x.TableName === 'RateLimit') { row.attempts = (row.attempts || 0) + 1; row.ttl = values[':ttl']; }
    else for (const term of x.UpdateExpression.replace(/^SET /, '').split(',')) {
      const [raw, value] = term.trim().split(/\s*=\s*/);
      row[x.ExpressionAttributeNames?.[raw] || raw] = values[value];
    }
    items(x.TableName).set(key(x.Key), row);
    return { Attributes: clone(row) };
  }
  throw new Error(`Unmocked operation ${name}`);
}
lambdaSdk.DynamoDBDocumentClient.from = () => ({ send });
async function cognitoSend(command) {
  const name = command.constructor.name;
  cognitoCalls.push(name);
  if (failCognitoGroup && name === 'AdminAddUserToGroupCommand') throw new Error('Group failure');
  if (name === 'AdminCreateUserCommand') return { User: { Username: command.input.Username, Attributes: [{ Name: 'sub', Value: `sub:${command.input.Username}` }] } };
  return {};
}
lambdaCognito.CognitoIdentityProviderClient.prototype.send = cognitoSend;
const { handler } = require('../lambda/api');
const { resolveHouseholdCode, householdKey } = require('../lambda/households');
const { parseCSV } = require('../lambda/csv');
const admin = { sub: 'admin', claims: { 'cognito:groups': ['ADMIN'] } };
const residentIdentity = { sub: 'user-1', username: 'user-1', claims: { 'cognito:groups': ['RESIDENT'] } };
const invoke = (fieldName, args = {}, identity = admin) => handler({ info: { fieldName }, arguments: args, identity, request: { headers: { 'x-forwarded-for': '192.0.2.1' } } });
const residentInput = () => ({ email: 'new@example.com', name: 'Resident', phone: '+14165551234', building: 'A', floor: '1', unitNumber: '101', plate: 'ABC123' });
const booking = () => ({ residentId: 'r1', residentCode: 'ABC123', unitNumber: '101', guestPlate: 'GUEST1', guestMobile: '+14165551234', guestEmail: 'guest@example.com', startTime: new Date().toISOString(), endTime: new Date(Date.now() + 3600000).toISOString() });
beforeEach(() => {
  db = {}; cognitoCalls = []; failCognitoGroup = false; failResidentPut = false; scanSize = 2;
  items('ParkingConfig').set('p1', { id: 'p1', name: 'Main', totalSpots: 2 });
  items('Resident').set('r1', { id: 'r1', email: 'existing@example.com', userId: 'user-1', householdId: 'ABC123', residentCode: 'ABC123', building: 'A', unitNumber: '101', floor: '1', plate: 'ABC1' });
});

test('every frontend GraphQL document conforms to the canonical schema', () => {
  const schema = buildSchema('directive @aws_api_key on OBJECT | FIELD_DEFINITION\ndirective @aws_cognito_user_pools on OBJECT | FIELD_DEFINITION\nscalar AWSDateTime\nscalar AWSEmail\nscalar AWSPhone\n' + fs.readFileSync('schema.graphql', 'utf8'));
  for (const file of ['src/lib/graphql.ts','src/components/AdminPanel.tsx','src/components/GuestReservation.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/`\s*((?:query|mutation)\s[\s\S]*?)`/g)) {
      assert.deepEqual(validate(schema, parse(match[1])).map(e => e.message), [], file);
    }
  }
});
test('household identity uses normalized building and unit, not floor', () => {
  assert.equal(householdKey({ building: ' a ', unitNumber: '101', floor: '1' }), householdKey({ building: 'A', unitNumber: '101', floor: '2' }));
});
test('manual creation reuses household code, stores Cognito sub, and returns credentials', async () => {
  const result = await invoke('createResidentWithCognito', { input: residentInput() });
  assert.equal(result.householdId, 'ABC123'); assert.equal(result.residentCode, result.householdId);
  assert.equal(result.userId, 'sub:new@example.com'); assert.ok(result.tempPassword.length > 12);
});
test('concurrent new members receive one household code', async () => {
  const codes = await Promise.all(Array.from({ length: 8 }, () => resolveHouseholdCode({ send }, { building: 'B', unitNumber: '12' })));
  assert.equal(new Set(codes).size, 1); assert.match(codes[0], /^[A-Z0-9]{6}$/);
});
test('legacy conflicting household codes fail without modifying residents', async () => {
  items('Resident').set('r2', { ...items('Resident').get('r1'), id: 'r2', householdId: 'DEF456' });
  await assert.rejects(resolveHouseholdCode({ send }, residentInput()), /conflicting/);
});
test('caller-supplied codes and invalid emails fail before Cognito writes', async () => {
  await assert.rejects(invoke('createResidentWithCognito', { input: { ...residentInput(), householdId: 'HACK12' } }), /generated/);
  await assert.rejects(invoke('createResidentWithCognito', { input: { ...residentInput(), email: 'invalid' } }), /email/);
  assert.equal(cognitoCalls.length, 0);
});
test('Cognito group failures roll back the created account', async () => {
  failCognitoGroup = true;
  await assert.rejects(invoke('createResidentWithCognito', { input: residentInput() }), /Group failure/);
  assert.ok(cognitoCalls.includes('AdminDeleteUserCommand'));
});
test('database failures roll back the created account', async () => {
  failResidentPut = true;
  await assert.rejects(invoke('createResidentWithCognito', { input: residentInput() }), /database failure/);
  assert.ok(cognitoCalls.includes('AdminDeleteUserCommand'));
});
test('all private APIs reject anonymous callers', async () => {
  for (const field of ['createResident','createResidentWithCognito','updateResident','deleteResident','importResidentsCSV','exportResidentsCSV','listResidents','listReservations','getResidentByUserId','getReservation','updateReservation','cancelReservation','deleteReservation','createParkingConfig','updateParkingConfig','deleteParkingConfig']) {
    await assert.rejects(invoke(field, { input: residentInput() }, null), /Unauthorized/, field);
  }
  await assert.rejects(invoke('getResident', { id: 'r1' }, null), /Unauthorized/);
});
test('residents can read only their own profile and booking', async () => {
  assert.equal((await invoke('getResident', { id: 'r1' }, residentIdentity)).id, 'r1');
  assert.equal((await invoke('getResidentByUserId', { userId: 'user-1' }, residentIdentity)).id, 'r1');
  await assert.rejects(invoke('getResident', { id: 'r1' }, { sub: 'other' }), /Unauthorized/);
  await assert.rejects(invoke('getResidentByUserId', { userId: 'other' }, residentIdentity), /Unauthorized/);
});
test('resident edits recalculate codes for the new address and reject manual codes', async () => {
  const result = await invoke('updateResident', { input: { id: 'r1', unitNumber: '102' } });
  assert.match(result.householdId, /^[A-Z0-9]{6}$/); assert.notEqual(result.householdId, 'ABC123');
  await assert.rejects(invoke('updateResident', { input: { id: 'r1', householdId: 'MANUAL' } }), /generated/);
});
test('resident deletion returns a full GraphQL record and disables sign in', async () => {
  const result = await invoke('deleteResident', { id: 'r1' });
  assert.equal(result.email, 'existing@example.com'); assert.ok(result.deletedAt);
  assert.ok(cognitoCalls.includes('AdminDisableUserCommand'));
});
test('CSV parser handles BOM, CRLF, escaped quotes and multiline fields', () => {
  const rows = parseCSV('\uFEFFemail,name,building,floor,unitNumber,plate\r\nx@example.com,"A, ""B""\nC",A,1,101,ABC123\r\n');
  assert.equal(rows[0].name, 'A, "B"\nC');
  assert.throws(() => parseCSV('email\na@example.com'), /missing/);
  assert.throws(() => parseCSV('email,name\na@example.com,"broken'), /Unclosed/);
});
test('CSV import shares code allocation, updates duplicates, reports partial failures', async () => {
  const result = await invoke('importResidentsCSV', { csvData: 'email,building,floor,unitNumber,plate\na@example.com,A,1,101,ABC123\na@example.com,A,1,101,ABC456\nbad,A,1,101,ABC789' });
  assert.equal(result.created, 1); assert.equal(result.updated, 1); assert.equal(result.failed, 1);
  assert.equal([...items('Resident').values()].find(r => r.email === 'a@example.com').householdId, 'ABC123');
});
test('CSV export returns a string, escapes formulas, handles missing addresses', async () => {
  items('Resident').set('r2', { id: 'r2', email: 'x@example.com', name: '=1+1' });
  const csv = await invoke('exportResidentsCSV'); assert.equal(typeof csv, 'string'); assert.ok(csv.includes("'=1+1"));
});
test('resident pagination supports multiple pages and filters deleted entries', async () => {
  items('Resident').set('r2', { id: 'r2', deletedAt: 'now' }); items('Resident').set('r3', { id: 'r3', residentCode: 'XYZ123' });
  const first = await invoke('listResidents', { limit: 2 }); assert.equal(first.items.length, 1); assert.ok(first.nextToken);
  const second = await invoke('listResidents', { limit: 2, nextToken: first.nextToken }); assert.equal(second.items[0].id, 'r3');
  await assert.rejects(invoke('listResidents', { limit: -1 }), /limit/);
});
test('public parking reads and availability sum every parking lot', async () => {
  items('ParkingConfig').set('p2', { id: 'p2', totalSpots: 3 });
  assert.equal((await invoke('listParkingConfigs', {}, null)).length, 2);
  assert.equal((await invoke('getParkingConfig', { id: 'p1' }, null)).totalSpots, 2);
  assert.equal((await invoke('checkAvailability', {}, null)).totalSpots, 5);
});
test('parking create, edit and delete validate capacity', async () => {
  const created = await invoke('createParkingConfig', { input: { name: 'Other', totalSpots: 1 } });
  assert.equal((await invoke('updateParkingConfig', { input: { id: created.id, totalSpots: 2 } })).totalSpots, 2);
  assert.equal((await invoke('deleteParkingConfig', { id: created.id })).id, created.id);
  await assert.rejects(invoke('createParkingConfig', { input: { totalSpots: -1 } }), /Capacity/);
});
test('booking validates credentials again and derives resident fields on server', async () => {
  await assert.rejects(invoke('createReservation', { input: { ...booking(), residentCode: 'WRONG1' } }, null), /Invalid resident/);
  await assert.rejects(invoke('createReservation', { input: { ...booking(), unitNumber: '999' } }, null), /Invalid resident/);
  const result = await invoke('createReservation', { input: { ...booking(), residentPlate: 'SPOOF' } }, null);
  assert.equal(result.householdId, 'ABC123'); assert.equal(result.residentPlate, 'ABC1');
});
test('booking rejects invalid dates, contacts and plates', async () => {
  for (const change of [{ endTime: 'bad' }, { endTime: new Date(Date.now() + 90000000).toISOString() }, { guestEmail: 'bad' }, { guestMobile: '123' }, { guestPlate: '<script>' }]) {
    await assert.rejects(invoke('createReservation', { input: { ...booking(), ...change } }, null));
  }
  assert.equal(items('Reservation').size, 0);
});
test('concurrent bookings cannot double book a household', async () => {
  const result = await Promise.allSettled([invoke('createReservation', { input: booking() }, null), invoke('createReservation', { input: { ...booking(), guestPlate: 'GUEST2' } }, null)]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(items('Reservation').size, 1);
});
test('sequential household, duplicate plate and capacity checks are enforced', async () => {
  await invoke('createReservation', { input: booking() }, null);
  await assert.rejects(invoke('createReservation', { input: { ...booking(), guestPlate: 'GUEST2' } }, null), /Household/);
  await assert.rejects(invoke('createReservation', { input: booking() }, null), /plate/);
  items('ParkingConfig').get('p1').totalSpots = 1;
  await assert.rejects(invoke('createReservation', { input: booking() }, null), /No parking/);
});
test('reservation list, get, extension, cancellation and deletion', async () => {
  const result = await invoke('createReservation', { input: booking() }, null);
  assert.equal((await invoke('listReservations')).items.length, 1);
  assert.equal((await invoke('getReservation', { id: result.id }, residentIdentity)).id, result.id);
  await assert.rejects(invoke('getReservation', { id: result.id }, { sub: 'other' }), /Unauthorized/);
  const endTime = new Date(Date.now() + 7200000).toISOString();
  assert.equal((await invoke('updateReservation', { input: { id: result.id, endTime } })).endTime, endTime);
  await assert.rejects(invoke('updateReservation', { input: { id: result.id, endTime } }), /Extension/);
  await assert.rejects(invoke('cancelReservation', { id: result.id }, { sub: 'other' }), /Unauthorized/);
  assert.equal((await invoke('cancelReservation', { id: result.id }, residentIdentity)).status, 'CANCELLED');
  assert.ok((await invoke('deleteReservation', { id: result.id })).deletedAt);
  assert.equal((await invoke('checkAvailability', {}, null)).availableSpots, 2);
});
test('capacity cannot shrink below occupied spots', async () => {
  await invoke('createReservation', { input: booking() }, null);
  await assert.rejects(invoke('updateParkingConfig', { input: { id: 'p1', totalSpots: 0 } }), /below active/);
  await assert.rejects(invoke('deleteParkingConfig', { id: 'p1' }), /below active/);
});
test('credential verification paginates and atomically limits attempts', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await invoke('verifyResidentCredentials', { residentCode: 'abc123', unitNumber: '101' }, null)).isValid, true);
  await assert.rejects(invoke('verifyResidentCredentials', { residentCode: 'ABC123', unitNumber: '101' }, null), /Too many/);
});
test('unknown operations fail explicitly', async () => { await assert.rejects(invoke('unknown'), /Unsupported/); });
test('four separate accounts share one code and one booking, visible to household members', async () => {
  for (let i = 2; i <= 4; i++) {
    const created = await invoke('createResidentWithCognito', { input: { ...residentInput(), email: `member${i}@example.com` } });
    assert.equal(created.householdId, 'ABC123');
  }
  const reservation = await invoke('createReservation', { input: booking() }, null);
  const member = { sub: 'sub:member2@example.com' };
  assert.equal((await invoke('listReservations', {}, member)).items.length, 1);
  assert.equal((await invoke('getReservation', { id: reservation.id }, member)).id, reservation.id);
  await assert.rejects(invoke('createReservation', { input: { ...booking(), guestPlate: 'GUEST2' } }, null), /Household/);
  assert.equal((await invoke('cancelReservation', { id: reservation.id }, member)).status, 'CANCELLED');
  assert.equal(items('Resident').size, 4);
});
