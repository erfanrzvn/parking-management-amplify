import boto3
import json

lambda_client = boto3.client('lambda', region_name='ca-central-1')

payload = {
    "arguments": {
        "csvData": "email,name,phone,building,floor,unitNumber,plate\ntest123@example.com,Test User,+14165551111,TestBuilding,1,101,TEST-123"
    }
}

try:
    response = lambda_client.invoke(
        FunctionName='parking-importResidentsCSV',
        InvocationType='RequestResponse',
        Payload=json.dumps(payload)
    )
    
    result = json.loads(response['Payload'].read())
    print("✅ Lambda Response:")
    print(json.dumps(result, indent=2))
    
except Exception as e:
    print(f"❌ Error: {e}")
