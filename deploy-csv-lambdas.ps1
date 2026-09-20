# Deploy CSV Import/Export Lambda functions to AppSync

$API_ID = "p6u7zkzkhrbuter3jhkvujkhpa"
$REGION = "ca-central-1"
$ACCOUNT_ID = "103103683543"

Write-Host "Creating AppSync DataSources..." -ForegroundColor Green

# Create DataSource for Export
$exportDS = aws appsync create-data-source `
  --api-id $API_ID `
  --name ExportResidentsCSVDataSource `
  --type AWS_LAMBDA `
  --service-role-arn "arn:aws:iam::${ACCOUNT_ID}:role/parking-csv-lambda-role" `
  --lambda-config "lambdaFunctionArn=arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:parking-exportResidentsCSV" `
  --region $REGION 2>&1

if ($LASTEXITCODE -ne 0 -and $exportDS -notlike "*already exists*") {
    Write-Host "Error creating export datasource: $exportDS" -ForegroundColor Red
}

# Create DataSource for Import
$importDS = aws appsync create-data-source `
  --api-id $API_ID `
  --name ImportResidentsCSVDataSource `
  --type AWS_LAMBDA `
  --service-role-arn "arn:aws:iam::${ACCOUNT_ID}:role/parking-csv-lambda-role" `
  --lambda-config "lambdaFunctionArn=arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:parking-importResidentsCSV" `
  --region $REGION 2>&1

if ($LASTEXITCODE -ne 0 -and $importDS -notlike "*already exists*") {
    Write-Host "Error creating import datasource: $importDS" -ForegroundColor Red
}

Write-Host "Creating AppSync Resolvers..." -ForegroundColor Green

# Export Resolver
$exportResolverCode = @'
import { util } from '@aws-appsync/utils';
export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: {},
  };
}
export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result.body;
}
'@

[System.IO.File]::WriteAllText("$PWD\export-resolver.js", $exportResolverCode)

aws appsync create-resolver `
  --api-id $API_ID `
  --type-name Query `
  --field-name exportResidentsCSV `
  --data-source-name ExportResidentsCSVDataSource `
  --runtime "name=APPSYNC_JS,runtimeVersion=1.0.0" `
  --code file://export-resolver.js `
  --region $REGION 2>&1 | Out-Null

# Import Resolver
$importResolverCode = @'
import { util } from '@aws-appsync/utils';
export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: ctx,
  };
}
export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
'@

[System.IO.File]::WriteAllText("$PWD\import-resolver.js", $importResolverCode)

aws appsync create-resolver `
  --api-id $API_ID `
  --type-name Mutation `
  --field-name importResidentsCSV `
  --data-source-name ImportResidentsCSVDataSource `
  --runtime "name=APPSYNC_JS,runtimeVersion=1.0.0" `
  --code file://import-resolver.js `
  --region $REGION 2>&1 | Out-Null

Remove-Item export-resolver.js, import-resolver.js -ErrorAction SilentlyContinue

Write-Host "✅ CSV Lambda functions deployed successfully!" -ForegroundColor Green
Write-Host "Export Lambda: parking-exportResidentsCSV"
Write-Host "Import Lambda: parking-importResidentsCSV"
