/**
 * Real API Tests - تست واقعی API های deploy شده روی AWS
 * این تست‌ها با GraphQL API واقعی روی AWS کار می‌کنند
 */

const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

async function graphqlRequest(query, variables = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();
  if (result.errors) {
    throw new Error(JSON.stringify(result.errors));
  }
  return result.data;
}

// Test 1: لیست ParkingConfigs
async function testListParkingConfigs() {
  console.log('\n🧪 Test 1: List ParkingConfigs');
  const query = `
    query {
      listParkingConfigs {
        id
        totalSpots
        updatedBy
        createdAt
      }
    }
  `;
  
  const data = await graphqlRequest(query);
  console.log('✅ Result:', JSON.stringify(data.listParkingConfigs, null, 2));
  return data.listParkingConfigs.length > 0;
}

// Test 2: ایجاد Reservation
async function testCreateReservation() {
  console.log('\n🧪 Test 2: Create Reservation');
  const query = `
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        residentId
        guestPlate
        guestEmail
        startTime
        endTime
        createdAt
      }
    }
  `;
  
  const variables = {
    input: {
      residentId: 'RES002',
      residentCode: 'XYZ98765',
      residentFloor: 'Floor-5',
      residentPlate: 'Tehran789',
      guestPlate: 'Tehran999',
      guestMobile: '+989129876543',
      guestEmail: 'guest2@example.com',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    },
  };
  
  const data = await graphqlRequest(query, variables);
  console.log('✅ Reservation Created:', data.createReservation.id);
  return !!data.createReservation.id;
}

// Test 3: لیست Reservations
async function testListReservations() {
  console.log('\n🧪 Test 3: List Reservations');
  const query = `
    query {
      listReservations {
        id
        residentId
        guestPlate
        guestEmail
        startTime
        endTime
      }
    }
  `;
  
  const data = await graphqlRequest(query);
  console.log(`✅ Found ${data.listReservations.length} reservations`);
  console.log('Reservations:', JSON.stringify(data.listReservations, null, 2));
  return data.listReservations.length > 0;
}

// Test 4: Update ParkingConfig
async function testUpdateParkingConfig() {
  console.log('\n🧪 Test 4: Update ParkingConfig');
  
  // اول لیست رو بگیر
  const listQuery = `query { listParkingConfigs { id } }`;
  const listData = await graphqlRequest(listQuery);
  
  if (listData.listParkingConfigs.length === 0) {
    console.log('⚠️ No ParkingConfig found to update');
    return false;
  }
  
  const configId = listData.listParkingConfigs[0].id;
  
  const mutation = `
    mutation UpdateConfig($input: UpdateParkingConfigInput!) {
      updateParkingConfig(input: $input) {
        id
        totalSpots
        updatedBy
        updatedAt
      }
    }
  `;
  
  const variables = {
    input: {
      id: configId,
      totalSpots: 25,
      updatedBy: 'test-script',
    },
  };
  
  const data = await graphqlRequest(mutation, variables);
  console.log('✅ ParkingConfig Updated:', JSON.stringify(data.updateParkingConfig, null, 2));
  return data.updateParkingConfig.totalSpots === 25;
}

// Test 5: Get specific Reservation
async function testGetReservation() {
  console.log('\n🧪 Test 5: Get Specific Reservation');
  
  // اول لیست رو بگیر
  const listQuery = `query { listReservations { id } }`;
  const listData = await graphqlRequest(listQuery);
  
  if (listData.listReservations.length === 0) {
    console.log('⚠️ No Reservation found');
    return false;
  }
  
  const reservationId = listData.listReservations[0].id;
  
  const query = `
    query GetReservation($id: ID!) {
      getReservation(id: $id) {
        id
        residentId
        guestPlate
        guestEmail
        startTime
        endTime
      }
    }
  `;
  
  const data = await graphqlRequest(query, { id: reservationId });
  console.log('✅ Reservation Found:', JSON.stringify(data.getReservation, null, 2));
  return !!data.getReservation;
}

// اجرای تمام تست‌ها
async function runAllTests() {
  console.log('🚀 Starting Real API Tests on AWS...\n');
  console.log('API URL:', API_URL);
  console.log('Region: ca-central-1');
  
  const tests = [
    { name: 'List ParkingConfigs', fn: testListParkingConfigs },
    { name: 'Create Reservation', fn: testCreateReservation },
    { name: 'List Reservations', fn: testListReservations },
    { name: 'Update ParkingConfig', fn: testUpdateParkingConfig },
    { name: 'Get Specific Reservation', fn: testGetReservation },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
        console.log(`❌ Test "${test.name}" returned false`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ Test "${test.name}" failed:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  process.exit(failed > 0 ? 1 : 0);
}

// اجرا
if (typeof fetch === 'undefined') {
  console.log('⚠️ This script requires Node.js 18+ with native fetch support');
  console.log('Or install node-fetch: npm install node-fetch');
  process.exit(1);
}

runAllTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
