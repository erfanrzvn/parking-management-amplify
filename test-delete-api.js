// Test deleteParkingConfig API
const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

async function testAPI(query, variables = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ query, variables })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Testing Delete Parking API...\n');
  
  // Step 1: Create a test parking
  console.log('1️⃣ Creating test parking...');
  const createMutation = `
    mutation CreateParkingConfig($input: CreateParkingConfigInput!) {
      createParkingConfig(input: $input) {
        id
        name
        totalSpots
        createdAt
      }
    }
  `;
  
  const createResult = await testAPI(createMutation, {
    input: {
      name: 'Test Parking for Delete',
      totalSpots: 10,
      updatedBy: 'test-script'
    }
  });
  
  if (createResult?.data?.createParkingConfig) {
    const parking = createResult.data.createParkingConfig;
    console.log('✅ Created parking:');
    console.log(`   ID: ${parking.id}`);
    console.log(`   Name: ${parking.name}`);
    console.log(`   Total Spots: ${parking.totalSpots}\n`);
    
    // Step 2: Delete the parking
    console.log('2️⃣ Deleting parking...');
    const deleteMutation = `
      mutation DeleteParkingConfig($id: ID!) {
        deleteParkingConfig(id: $id) {
          id
        }
      }
    `;
    
    const deleteResult = await testAPI(deleteMutation, {
      id: parking.id
    });
    
    if (deleteResult?.data?.deleteParkingConfig) {
      console.log('✅ Parking deleted successfully');
      console.log(`   Deleted ID: ${deleteResult.data.deleteParkingConfig.id}\n`);
    } else {
      console.log('❌ Delete failed');
      console.log(deleteResult);
    }
    
    // Step 3: Verify deletion
    console.log('3️⃣ Verifying deletion...');
    const getQuery = `
      query GetParkingConfig($id: ID!) {
        getParkingConfig(id: $id) {
          id
          name
        }
      }
    `;
    
    const getResult = await testAPI(getQuery, { id: parking.id });
    
    if (getResult?.data?.getParkingConfig === null) {
      console.log('✅ Verified: Parking no longer exists\n');
    } else {
      console.log('⚠️ Warning: Parking still exists after deletion');
      console.log(getResult);
    }
    
  } else {
    console.log('❌ Failed to create test parking');
    console.log(createResult);
  }
  
  console.log('✅ All delete API tests completed!');
}

runTests().catch(console.error);
