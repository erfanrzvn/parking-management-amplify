const sdk = require('@aws-sdk/client-cognito-identity-provider');
const { requireAdmin } = require('./access');
const client = new sdk.CognitoIdentityProviderClient({});
const pool = () => process.env.USER_POOL_ID;
const account = user => {
  const attrs = user.Attributes || user.UserAttributes || [];
  const attr = name => attrs.find(a => a.Name === name)?.Value;
  return { username: user.Username, email: attr('email'), name: attr('name') || '', enabled: !!user.Enabled, status: user.UserStatus };
};
exports.requireEnabled = async event => {
  const user = await client.send(new sdk.AdminGetUserCommand({ UserPoolId: pool(), Username: event.identity.username || event.identity.sub }));
  if (!user.Enabled) throw new Error('Unauthorized');
};
exports.handler = async event => {
  requireAdmin(event);
  const args = event.arguments || {};
  if (event.info.fieldName === 'listGuards') {
    const users = []; let NextToken;
    do {
      const result = await client.send(new sdk.ListUsersInGroupCommand({ UserPoolId: pool(), GroupName: 'GUARD', NextToken }));
      users.push(...result.Users.map(account)); NextToken = result.NextToken;
    } while (NextToken);
    return users;
  }
  if (event.info.fieldName === 'setGuardEnabled') {
    // Never let guard administration modify an admin or resident account.
    const groups = []; let NextToken;
    do {
      const result = await client.send(new sdk.AdminListGroupsForUserCommand({ UserPoolId: pool(), Username: args.username, NextToken }));
      groups.push(...result.Groups.map(g => g.GroupName)); NextToken = result.NextToken;
    } while (NextToken);
    if (!groups.includes('GUARD') || groups.some(g => g !== 'GUARD')) throw new Error('Account is not a guard-only account');
    const Command = args.enabled ? sdk.AdminEnableUserCommand : sdk.AdminDisableUserCommand;
    await client.send(new Command({ UserPoolId: pool(), Username: args.username }));
    if (!args.enabled) await client.send(new sdk.AdminUserGlobalSignOutCommand({ UserPoolId: pool(), Username: args.username }));
    return account(await client.send(new sdk.AdminGetUserCommand({ UserPoolId: pool(), Username: args.username })));
  }
  const input = args.input || {};
  const email = String(input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required as the username');
  const password = input.temporaryPassword;
  if (typeof password !== 'string' || password.length < 8 || password.length > 256 || /\s/.test(password) || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) throw new Error('Temporary password needs 8+ characters, uppercase, lowercase, number and symbol, without spaces');
  const attributes = [{ Name: 'email', Value: email }];
  if (input.name?.trim()) attributes.push({ Name: 'name', Value: input.name.trim() });
  let username;
  try {
    const result = await client.send(new sdk.AdminCreateUserCommand({ UserPoolId: pool(), Username: email, TemporaryPassword: password, MessageAction: 'SUPPRESS', UserAttributes: attributes }));
    username = result.User.Username;
    await client.send(new sdk.AdminAddUserToGroupCommand({ UserPoolId: pool(), Username: username, GroupName: 'GUARD' }));
    return account(result.User);
  } catch (error) {
    if (username) {
      try { await client.send(new sdk.AdminDeleteUserCommand({ UserPoolId: pool(), Username: username })); }
      catch (rollbackError) { console.error('Guard rollback failed', rollbackError.name); }
    }
    throw error;
  }
};
