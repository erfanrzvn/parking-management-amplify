// Explicit cutover helper. Save the live schema/resolvers first; see RELEASE.md.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('graphql');
if (!process.env.APPSYNC_API_ID || !process.env.AWS_REGION) throw new Error('APPSYNC_API_ID and AWS_REGION are required');
const root = path.resolve(__dirname, '..');
const aws = args => execFileSync('aws', [...args, '--region', process.env.AWS_REGION, '--no-cli-pager'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const apiId = process.env.APPSYNC_API_ID;
const schema = parse(fs.readFileSync(path.join(root, 'schema.graphql'), 'utf8'));
const runtime = JSON.stringify({ name: 'APPSYNC_JS', runtimeVersion: '1.0.0' });
for (const type of schema.definitions.filter(d => ['Query','Mutation'].includes(d.name?.value))) {
  const current = JSON.parse(aws(['appsync','list-resolvers','--api-id',apiId,'--type-name',type.name.value])).resolvers;
  for (const field of type.fields) {
    const action = current.some(r => r.fieldName === field.name.value) ? 'update-resolver' : 'create-resolver';
    aws(['appsync', action, '--api-id', apiId, '--type-name', type.name.value, '--field-name', field.name.value,
      '--data-source-name','ParkingUnifiedApi','--kind','UNIT','--runtime',runtime,'--code','file://scripts/appsync-runtime.js']);
    console.log(`${type.name.value}.${field.name.value}`);
  }
}
