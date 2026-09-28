function inGroup(event, name) {
  const groups = event.identity?.claims?.['cognito:groups'] || event.identity?.groups || [];
  return (Array.isArray(groups) ? groups : String(groups).split(',')).some(g => g.toUpperCase() === name);
}
const isAdmin = event => inGroup(event, 'ADMIN');
const isGuard = event => inGroup(event, 'GUARD');
function requireAdmin(event) {
  if (!isAdmin(event) || isGuard(event)) throw new Error('Unauthorized');
}
module.exports = { isAdmin, isGuard, requireAdmin };
