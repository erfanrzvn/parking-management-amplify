// Explicitly authorized test-data reset. Keeps parking settings and ADMIN users.
// No wildcards: deletes only scanned keys from the listed parking tables.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../lambda/api.js'));
const { DynamoDBClient } = local('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = local('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminListGroupsForUserCommand, AdminDeleteUserCommand, ListUsersInGroupCommand } = local('@aws-sdk/client-cognito-identity-provider');
const { scanAll } = require('../lambda/households');
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Explicit --apply is required');
  for (const key of ['HOUSEHOLD_TABLE','NEW_RATE_LIMIT_TABLE']) if (!process.env[key]?.startsWith('parking-management-unified-api-')) throw new Error(`Unexpected ${key}`);
  const account = JSON.parse(execFileSync('aws',['sts','get-caller-identity','--output','json'],{encoding:'utf8'})).Account;
  if (account !== '103103683543') throw new Error('Unexpected AWS account');
  const region = 'ca-central-1', UserPoolId = 'ca-central-1_dBeo5yZXq';
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  const cognito = new CognitoIdentityProviderClient({ region });
  const tables = ['Resident','Reservation','AuditLog','RateLimit',process.env.HOUSEHOLD_TABLE,process.env.NEW_RATE_LIMIT_TABLE];
  const snapshots = {};
  for (const TableName of tables) snapshots[TableName] = await scanAll(db, { TableName, ConsistentRead: true });
  const users = new Map(), preservedAdmins = new Set();
  for (const resident of snapshots.Resident) {
    let user;
    for (const Username of [...new Set([resident.cognitoUsername, resident.userId, resident.email].filter(Boolean))]) {
      try { user = await cognito.send(new AdminGetUserCommand({ UserPoolId, Username })); break; }
      catch (error) { if (error.name !== 'UserNotFoundException') throw error; }
    }
    if (!user) continue;
    // Require the Cognito email to match the resident record before deletion.
    const email = user.UserAttributes?.find(a => a.Name === 'email')?.Value;
    if (email?.toLowerCase() !== resident.email?.toLowerCase()) continue;
    const groups = (await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId, Username: user.Username }))).Groups || [];
    if (groups.some(g => g.GroupName.toUpperCase() === 'ADMIN')) preservedAdmins.add(user.Username);
    else users.set(user.Username, user);
  }
  // The user authorized clearing this pool's test resident accounts. Protect
  // anyone who also belongs to ADMIN, including stale resident links.
  let NextToken;
  do {
    const page = await cognito.send(new ListUsersInGroupCommand({ UserPoolId, GroupName: 'RESIDENT', NextToken }));
    for (const user of page.Users || []) {
      const groups = (await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId, Username: user.Username }))).Groups || [];
      if (groups.some(g => g.GroupName.toUpperCase() === 'ADMIN')) preservedAdmins.add(user.Username);
      else users.set(user.Username, user);
    }
    NextToken = page.NextToken;
  } while (NextToken);
  const backup = path.resolve(__dirname, '../build/backups', `test-reset-${Date.now()}`);
  fs.mkdirSync(backup, { recursive: true });
  fs.writeFileSync(path.join(backup, 'tables.json'), JSON.stringify(snapshots, null, 2));
  fs.writeFileSync(path.join(backup, 'cognito-users.json'), JSON.stringify([...users.values()], null, 2));
  for (const Username of users.keys()) await cognito.send(new AdminDeleteUserCommand({ UserPoolId, Username }));
  for (const TableName of tables) {
    const keyName = TableName === 'RateLimit' || TableName === process.env.NEW_RATE_LIMIT_TABLE ? 'key' : 'id';
    const rows = snapshots[TableName];
    for (let index = 0; index < rows.length; index += 25) {
      let RequestItems = { [TableName]: rows.slice(index, index + 25).map(r => ({ DeleteRequest: { Key: { [keyName]: r[keyName] } } })) };
      for (let attempt = 0; attempt < 6; attempt++) {
        const result = await db.send(new BatchWriteCommand({ RequestItems }));
        RequestItems = result.UnprocessedItems || {};
        if (!Object.values(RequestItems).some(rows => rows.length)) break;
        if (attempt === 5) throw new Error('Unprocessed deletes remain; rerun reset');
        await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
      }
    }
  }
  const remaining = {};
  for (const TableName of tables) remaining[TableName] = (await scanAll(db, { TableName, ConsistentRead: true })).length;
  const report = { backup, deletedUsers: users.size, preservedAdminUsers: preservedAdmins.size, deletedRecords: Object.fromEntries(Object.entries(snapshots).map(([k,v]) => [k,v.length])), remaining };
  fs.writeFileSync(path.resolve(__dirname,'../build/test-reset-report.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if (Object.values(remaining).some(Boolean)) throw new Error('Reset verification failed');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
