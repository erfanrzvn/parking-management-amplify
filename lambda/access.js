function isAdmin(event) {
  const groups = event.identity?.claims?.['cognito:groups'] || event.identity?.groups || [];
  return (Array.isArray(groups) ? groups : String(groups).split(',')).some(g => g.toUpperCase() === 'ADMIN');
}
function requireAdmin(event) {
  if (!isAdmin(event)) throw new Error('Unauthorized');
}
module.exports = { isAdmin, requireAdmin };
