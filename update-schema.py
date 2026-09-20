import boto3
import json

# Read schema file
with open('schema.graphql', 'r', encoding='utf-8') as f:
    schema_definition = f.read()

# Initialize AppSync client
client = boto3.client('appsync', region_name='ca-central-1')

# Start schema creation
try:
    response = client.start_schema_creation(
        apiId='p6u7zkzkhrbuter3jhkvujkhpa',
        definition=schema_definition.encode('utf-8')
    )
    print(f"Schema update started: {response['status']}")
    
    # Check status
    import time
    time.sleep(5)
    
    status_response = client.get_schema_creation_status(
        apiId='p6u7zkzkhrbuter3jhkvujkhpa'
    )
    print(f"Schema update status: {status_response['status']}")
    if status_response['status'] == 'FAILED':
        print(f"Error details: {status_response.get('details', 'No details')}")
    else:
        print("Schema updated successfully!")
        
except Exception as e:
    print(f"Error: {e}")
