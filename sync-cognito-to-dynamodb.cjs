const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: 'ca-central-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Cognito users that need to be synced to DynamoDB
const cognitoResidents = [
  {
    userId: 'dcad0598-7051-7031-928f-1f3c147ff405',
    email: 'ads@asd.com',
    residentCode: 'UKA935',
    floor: '2',
    plate: 'ABC1234',
    building: 'as', // from the logs
    unitNumber: '123'
  },
  {
    userId: '1c3d5568-40e1-70fd-5aa3-c27b0dde992f',
    email: 'test.resident@example.com',
    residentCode: 'QRQ804',
    floor: '5',
    plate: 'ABC123',
    building: 'Tower A',
    unitNumber: '502'
  }
];

async function syncCognitoToDynamoDB() {
  console.log('Starting Cognito to DynamoDB sync...\n');
  
  for (const resident of cognitoResidents) {
    try {
      // Check if resident already exists in DynamoDB by userId
      const scanCommand = new ScanCommand({
        TableName: 'Resident',
        FilterExpression: 'userId = :userId AND attribute_not_exists(deletedAt)',
        ExpressionAttributeValues: {
          ':userId': resident.userId
        }
      });
      
      const existingResult = await docClient.send(scanCommand);
      
      if (existingResult.Items && existingResult.Items.length > 0) {
        console.log(`✓ ${resident.email} already exists in DynamoDB (id: ${existingResult.Items[0].id})`);
        
        // Update userId if it's wrong
        const existingItem = existingResult.Items[0];
        if (existingItem.userId !== resident.userId) {
          console.log(`  Updating userId from ${existingItem.userId} to ${resident.userId}`);
          // Update logic here if needed
        }
        continue;
      }
      
      // Create new resident record
      const now = new Date().toISOString();
      const residentId = `resident_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const newResident = {
        id: residentId,
        userId: resident.userId,
        email: resident.email,
        residentCode: resident.residentCode,
        floor: resident.floor,
        plate: resident.plate,
        building: resident.building,
        unitNumber: resident.unitNumber,
        createdAt: now,
        updatedAt: now
      };
      
      const putCommand = new PutCommand({
        TableName: 'Resident',
        Item: newResident
      });
      
      await docClient.send(putCommand);
      console.log(`✓ Created resident: ${resident.email} (id: ${residentId})`);
      
    } catch (error) {
      console.error(`✗ Error syncing ${resident.email}:`, error.message);
    }
  }
  
  console.log('\nSync complete!');
}

syncCognitoToDynamoDB().catch(console.error);
