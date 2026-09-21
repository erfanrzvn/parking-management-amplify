import boto3

appsync = boto3.client('appsync', region_name='ca-central-1')
api_id = 'p6u7zkzkhrbuter3jhkvujkhpa'

export_code = """import { util } from '@aws-appsync/utils';
export function request(ctx) {
  return { operation: 'Invoke', payload: {} };
}
export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}"""

try:
    response = appsync.create_resolver(
        apiId=api_id,
        typeName='Mutation',
        fieldName='exportResidentsCSV',
        dataSourceName='ExportResidentsCSVDataSource',
        runtime={'name': 'APPSYNC_JS', 'runtimeVersion': '1.0.0'},
        code=export_code
    )
    print("✅ Created exportResidentsCSV resolver")
except Exception as e:
    print(f"❌ Error: {e}")
