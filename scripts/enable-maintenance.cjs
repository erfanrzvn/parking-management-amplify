const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const base = ['--region','ca-central-1','--no-cli-pager'];
const apiId = 'p6u7zkzkhrbuter3jhkvujkhpa';
const data = JSON.parse(execFileSync('aws',['appsync','list-resolvers','--api-id',apiId,'--type-name','Mutation','--output','json',...base],{encoding:'utf8'}));
for (const resolver of data.resolvers) {
  execFileSync('aws',['appsync','update-resolver','--api-id',apiId,'--type-name','Mutation','--field-name',resolver.fieldName,
    '--data-source-name',resolver.dataSourceName,'--kind','UNIT','--runtime',JSON.stringify({name:'APPSYNC_JS',runtimeVersion:'1.0.0'}),
    '--code','file://scripts/maintenance-resolver.js',...base],{cwd:root,stdio:['ignore','pipe','pipe']});
}
console.log('Mutations temporarily paused for release cutover.');
