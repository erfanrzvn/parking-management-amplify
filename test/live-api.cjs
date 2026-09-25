// Real AppSync/Cognito/DynamoDB integration test. Creates isolated fixtures and
// removes only the exact IDs/usernames recorded by this run, including on failure.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../lambda/api.js'));
const cognitoSDK = local('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = local('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, ScanCommand } = local('@aws-sdk/lib-dynamodb');
const outputs = require('../amplify_outputs.json');
if (process.env.TEST_API_CONFIG) {
  const testApi = JSON.parse(fs.readFileSync(process.env.TEST_API_CONFIG, 'utf8').replace(/^\uFEFF/, ''));
  outputs.data.url = testApi.url;
  outputs.data.api_key = testApi.apiKey;
}
const region = outputs.data.aws_region, pool = outputs.auth.user_pool_id;
const cognito = new cognitoSDK.CognitoIdentityProviderClient({ region });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const suffix = `${Date.now()}${randomBytes(3).toString('hex')}`;
const fixture = { users: [], Resident: [], Reservation: [], ParkingConfig: [], registry: [] };
const passed = [], coverage = new Set();
const reportPath = path.resolve(__dirname, '../build/live-api-report.json');
const fixturePath = path.resolve(__dirname, '../build/live-api-fixtures.json');
const persist = () => fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
let failure;
async function gql(query, variables = {}, token) {
  if (process.env.TEST_LAMBDA_FUNCTION) {
    const { buildSchema, graphql } = require('graphql');
    const { LambdaClient, InvokeCommand } = local('@aws-sdk/client-lambda');
    const client = new LambdaClient({ region });
    const schema = buildSchema('directive @aws_api_key on OBJECT | FIELD_DEFINITION\ndirective @aws_cognito_user_pools on OBJECT | FIELD_DEFINITION\nscalar AWSDateTime\nscalar AWSEmail\nscalar AWSPhone\n' + fs.readFileSync(path.resolve(__dirname, '../schema.graphql'), 'utf8'));
    const claims = token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) : null;
    const rootValue = {};
    for (const type of [schema.getQueryType(), schema.getMutationType()]) for (const field of Object.keys(type.getFields())) {
      rootValue[field] = async (args, context, info) => {
        const payload = { arguments: args, info: { fieldName: info.fieldName, parentTypeName: info.parentType.name },
          identity: claims ? { sub: claims.sub, username: claims['cognito:username'], claims } : null,
          request: { headers: { 'x-forwarded-for': '192.0.2.1' } } };
        const result = await client.send(new InvokeCommand({ FunctionName: process.env.TEST_LAMBDA_FUNCTION, Payload: Buffer.from(JSON.stringify(payload)) }));
        const body = JSON.parse(Buffer.from(result.Payload).toString());
        if (result.FunctionError) throw new Error(body.errorMessage);
        return body;
      };
    }
    const result = await graphql({ schema, source: query, variableValues: variables, rootValue });
    if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
    return result.data;
  }
  const response = await fetch(outputs.data.url, { method: 'POST', signal: AbortSignal.timeout(25000),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : { 'x-api-key': outputs.data.api_key }) },
    body: JSON.stringify({ query, variables }) });
  const data = await response.json();
  if (!response.ok || data.errors?.length) throw new Error(data.errors?.map(e => e.message).join('; ') || `HTTP ${response.status}`);
  return data.data;
}
async function step(name, action) { await action(); passed.push(name); console.log(`PASS ${name}`); }
async function main() {
  if (!process.argv.includes('--write-fixtures') || !process.env.HOUSEHOLD_TABLE) throw new Error('--write-fixtures and HOUSEHOLD_TABLE are required');
  const { Amplify } = await import('aws-amplify');
  const auth = await import('aws-amplify/auth');
  Amplify.configure(outputs);
  async function login(email, tempPassword) {
    await auth.signOut();
    const first = await auth.signIn({ username: email, password: tempPassword });
    assert.equal(first.nextStep.signInStep, 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED');
    const result = await auth.confirmSignIn({ challengeResponse: `Aa1!${randomBytes(18).toString('base64url')}` });
    assert.equal(result.isSignedIn, true);
    return (await auth.fetchAuthSession()).tokens.idToken.toString();
  }
  const adminEmail = `codex-parking-admin-${suffix}@example.com`;
  const password = `Aa1!${randomBytes(18).toString('base64url')}`;
  await cognito.send(new cognitoSDK.AdminCreateUserCommand({ UserPoolId: pool, Username: adminEmail, TemporaryPassword: password, MessageAction: 'SUPPRESS', UserAttributes: [{ Name: 'email', Value: adminEmail }, { Name: 'email_verified', Value: 'true' }] }));
  fixture.users.push(adminEmail); persist();
  await cognito.send(new cognitoSDK.AdminAddUserToGroupCommand({ UserPoolId: pool, Username: adminEmail, GroupName: 'ADMIN' }));
  const adminToken = await login(adminEmail, password);
  passed.push('Cognito SRP login and temporary-password challenge');
  await step('public parking/availability queries', async () => {
    const data = await gql('{ listParkingConfigs { id totalSpots } checkAvailability { available availableSpots totalSpots message } }');
    assert.ok(Array.isArray(data.listParkingConfigs));
    if (data.listParkingConfigs[0]) assert.ok((await gql('query($id:ID!){ getParkingConfig(id:$id){id} }', { id: data.listParkingConfigs[0].id })).getParkingConfig);
    ['listParkingConfigs','getParkingConfig','checkAvailability'].forEach(x => coverage.add(`Query.${x}`));
  });
  await step('public cannot enumerate private data', async () => {
    await assert.rejects(gql('{ listResidents { items { id } } }'), /authorized/i);
    await assert.rejects(gql('{ listReservations { items { id } } }'), /authorized/i);
  });
  const parking = (await gql('mutation($input:CreateParkingConfigInput!){createParkingConfig(input:$input){id totalSpots}}', { input: { name: `API validation ${suffix}`, totalSpots: 2 } }, adminToken)).createParkingConfig;
  fixture.ParkingConfig.push(parking.id); persist(); coverage.add('Mutation.createParkingConfig');
  await step('parking edit and get', async () => {
    const data = await gql('mutation($input:UpdateParkingConfigInput!){updateParkingConfig(input:$input){id totalSpots}}', { input: { id: parking.id, totalSpots: 3 } }, adminToken);
    assert.equal(data.updateParkingConfig.totalSpots, 3); coverage.add('Mutation.updateParkingConfig');
  });
  const address = { building: `CODEX-${suffix}`, floor: '1', unitNumber: '1', plate: 'TEST123' };
  async function createResident(email, operation = 'createResidentWithCognito') {
    const inputType = operation === 'createResident' ? 'CreateResidentInput' : 'CreateResidentWithCognitoInput';
    const result = (await gql(`mutation($input:${inputType}!){${operation}(input:$input){id email householdId residentCode userId ${operation === 'createResidentWithCognito' ? 'tempPassword' : ''}}}`, { input: { ...address, email, name: 'API validation' } }, adminToken))[operation];
    fixture.Resident.push(result.id); fixture.users.push(email); fixture.registry.push(`code:${result.householdId}`); fixture.registry.push(`address:${JSON.stringify([address.building.toUpperCase(), '1'])}`); persist();
    coverage.add(`Mutation.${operation}`); return result;
  }
  const first = await createResident(`codex-parking-a-${suffix}@example.com`);
  const second = await createResident(`codex-parking-b-${suffix}@example.com`);
  await step('separate accounts share a server-generated code', async () => {
    assert.notEqual(first.userId, second.userId); assert.equal(first.householdId, second.householdId); assert.match(first.householdId, /^[A-Z0-9]{6}$/);
  });
  const residentToken = await login(first.email, first.tempPassword);
  const secondToken = await login(second.email, second.tempPassword);
  await step('resident profile access and admin pagination', async () => {
    const own = await gql('query($id:ID!,$userId:String!){getResident(id:$id){id} getResidentByUserId(userId:$userId){id householdId}}', { id: first.id, userId: first.userId }, residentToken);
    assert.equal(own.getResident.id, first.id);
    await assert.rejects(gql('query($id:ID!){getResident(id:$id){id}}', { id: second.id }, residentToken), /Unauthorized/);
    let nextToken, count = 0;
    do {
      const result = (await gql('query($nextToken:String){listResidents(limit:7,nextToken:$nextToken){items{id} nextToken}}', { nextToken }, adminToken)).listResidents;
      count += result.items.length; nextToken = result.nextToken;
    } while (nextToken);
    assert.ok(count >= 2); ['getResident','getResidentByUserId','listResidents'].forEach(x => coverage.add(`Query.${x}`));
  });
  await step('resident update', async () => {
    const updated = (await gql('mutation($input:UpdateResidentInput!){updateResident(input:$input){id name householdId}}', { input: { id: first.id, name: 'API validation updated' } }, adminToken)).updateResident;
    assert.equal(updated.householdId, first.householdId); coverage.add('Mutation.updateResident');
  });
  await step('credential verification', async () => {
    const check = (await gql('mutation($code:String!,$unit:String!){verifyResidentCredentials(residentCode:$code,unitNumber:$unit){isValid}}', { code: first.householdId, unit: '1' })).verifyResidentCredentials;
    assert.equal(check.isValid, true); coverage.add('Mutation.verifyResidentCredentials');
  });
  const reservationInput = { residentCode: first.householdId, unitNumber: '1', guestPlate: 'TESTGUEST1', guestMobile: '+14165551234', guestEmail: `codex-guest-${suffix}@example.com`, startTime: new Date().toISOString(), endTime: new Date(Date.now() + 3600000).toISOString() };
  const createBooking = async input => {
    const result = (await gql('mutation($input:CreateReservationInput!){createReservation(input:$input){id residentId householdId endTime}}', { input })).createReservation;
    fixture.Reservation.push(result.id); persist(); return result;
  };
  let reservation;
  await step('concurrent requests allow only one guest for a household', async () => {
    const outcomes = await Promise.allSettled([createBooking(reservationInput), createBooking({ ...reservationInput, guestPlate: 'TESTGUEST2' })]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1, JSON.stringify(outcomes.map(r => r.status === 'rejected' ? r.reason.message : 'success')));
    reservation = outcomes.find(r => r.status === 'fulfilled').value; coverage.add('Mutation.createReservation');
  });
  await step('all household members see the same reservation', async () => {
    const data = await gql('query($id:ID!){getReservation(id:$id){id} listReservations {items{id} nextToken}}', { id: reservation.id }, secondToken);
    assert.equal(data.getReservation.id, reservation.id); assert.ok(data.listReservations.items.some(r => r.id === reservation.id));
    coverage.add('Query.getReservation'); coverage.add('Query.listReservations');
  });
  await step('duplicate household booking and invalid credentials are rejected', async () => {
    await assert.rejects(createBooking({ ...reservationInput, guestPlate: 'TESTGUEST3' }), /Household/);
    await assert.rejects(createBooking({ ...reservationInput, unitNumber: '999' }), /Invalid resident/);
  });
  await step('booking extension and household cancellation', async () => {
    const endTime = new Date(Date.now() + 7200000).toISOString();
    const result = (await gql('mutation($input:UpdateReservationInput!){updateReservation(input:$input){id endTime}}', { input: { id: reservation.id, endTime } }, adminToken)).updateReservation;
    assert.equal(result.endTime, endTime); coverage.add('Mutation.updateReservation');
    const cancelled = (await gql('mutation($id:ID!){cancelReservation(id:$id){id status deletedAt}}', { id: reservation.id }, secondToken)).cancelReservation;
    assert.equal(cancelled.status, 'CANCELLED'); coverage.add('Mutation.cancelReservation');
    await gql('mutation($id:ID!){deleteReservation(id:$id){id}}', { id: reservation.id }, adminToken); coverage.add('Mutation.deleteReservation');
  });
  await step('CSV export query and legacy mutation', async () => {
    const data = await gql('{exportResidentsCSV}', {}, adminToken); assert.ok(data.exportResidentsCSV.startsWith('email,')); coverage.add('Query.exportResidentsCSV');
    const legacy = await gql('mutation{exportResidentsCSV{success count csvData}}', {}, adminToken); assert.equal(legacy.exportResidentsCSV.success, true); coverage.add('Mutation.exportResidentsCSV');
  });
  await step('CSV import shares code and returns new-account credentials', async () => {
    const email = `codex-parking-c-${suffix}@example.com`;
    const csvData = `email,name,building,floor,unitNumber,plate\n${email},API import,${address.building},1,1,TEST456`;
    // Track the username before import so cleanup still runs after a partial error.
    fixture.users.push(email); persist();
    const result = (await gql('mutation($csv:String!){importResidentsCSV(csvData:$csv){success created updated failed errors credentials{email residentCode tempPassword}}}', { csv: csvData }, adminToken)).importResidentsCSV;
    assert.equal(result.success, true, JSON.stringify(result.errors)); assert.equal(result.created, 1); assert.equal(result.credentials[0].residentCode, first.householdId); coverage.add('Mutation.importResidentsCSV');
    let nextToken;
    do {
      const page = (await gql('query($token:String){listResidents(limit:100,nextToken:$token){items{id email} nextToken}}', { token: nextToken }, adminToken)).listResidents;
      for (const row of page.items.filter(r => r.email === email)) fixture.Resident.push(row.id);
      nextToken = page.nextToken;
    } while (nextToken); persist();
  });
  await createResident(`codex-parking-d-${suffix}@example.com`, 'createResident');
  await step('resident and parking deletion', async () => {
    const deleted = (await gql('mutation($id:ID!){deleteResident(id:$id){id email deletedAt}}', { id: first.id }, adminToken)).deleteResident;
    assert.ok(deleted.deletedAt); coverage.add('Mutation.deleteResident');
    await gql('mutation($id:ID!){deleteParkingConfig(id:$id){id}}', { id: parking.id }, adminToken); coverage.add('Mutation.deleteParkingConfig');
  });
  await auth.signOut();
  assert.equal(coverage.size, 23);
}
async function cleanup() {
  const errors = [];
  // Discover only fixture emails from this run if an import returned partial data.
  let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({ TableName: 'Resident', ExclusiveStartKey }));
    for (const row of (page.Items || []).filter(r => fixture.users.includes(r.email))) fixture.Resident.push(row.id);
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  for (const TableName of ['Reservation','Resident','ParkingConfig']) for (const id of new Set(fixture[TableName])) {
    try { await db.send(new DeleteCommand({ TableName, Key: { id } })); } catch (error) { errors.push(`${TableName}: ${error.name}`); }
  }
  for (const Username of new Set(fixture.users)) {
    try { await cognito.send(new cognitoSDK.AdminDeleteUserCommand({ UserPoolId: pool, Username })); }
    catch (error) { if (error.name !== 'UserNotFoundException') errors.push(`Cognito: ${error.name}`); }
  }
  for (const id of new Set(fixture.registry)) {
    try { await db.send(new DeleteCommand({ TableName: process.env.HOUSEHOLD_TABLE, Key: { id } })); }
    catch (error) { errors.push(`Registry: ${error.name}`); }
  }
  return errors;
}
(async () => {
  let cleanupErrors = [];
  try { await main(); }
  catch (error) { failure = error.message; console.error('FAIL', failure); }
  finally { if (fixture.users.length) { try { cleanupErrors = await cleanup(); } catch (error) { cleanupErrors.push(error.message); } } }
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ mode: process.env.TEST_LAMBDA_FUNCTION ? 'AWS Lambda + local GraphQL executor' : 'AWS AppSync', time: new Date().toISOString(), passed, coverage: [...coverage].sort(), failure: failure || null, cleanupErrors }, null, 2));
  console.log(JSON.stringify({ passed: passed.length, apiOperations: coverage.size, cleanupErrors }));
  if (failure || cleanupErrors.length) process.exitCode = 1;
})();
