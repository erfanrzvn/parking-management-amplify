/**
 * ========================================================================
 *                  COMPREHENSIVE API TEST - ALL OPERATIONS
 * ========================================================================
 */

const https = require('https');

const CONFIG = {
  API_URL: 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql',
  API_KEY: 'da2-5rll2d4qm5dlxl5szpdw3ra3ra',
};

async function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(CONFIG.API_URL, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.errors) {
            reject(parsed.errors);
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function log(status, message) {
  console.log(`${status} ${message}`);
}

async function testAPI(name, query, variables) {
  try {
    const data = await graphqlRequest(query, variables);
    log('✅', `${name}: SUCCESS`);
    return { success: true, data };
  } catch (error) {
    log('❌', `${name}: FAILED`);
    console.log('   Error:', JSON.stringify(error, null, 2));
    return { success: false, error };
  }
}

async function runTests() {
  console.log('\n🧪 COMPREHENSIVE API TEST SUITE\n');
  console.log('='.repeat(70));
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // ========================================================================
  // 1. PARKING CONFIG TESTS
  // ========================================================================
  console.log('\n📦 PARKING CONFIG OPERATIONS\n');
  
  const test1 = await testAPI(
    'List Parking Configs',
    'query { listParkingConfigs { id name totalSpots updatedAt updatedBy createdAt } }'
  );
  results.tests.push(test1);
  test1.success ? results.passed++ : results.failed++;

  // ========================================================================
  // 2. RESIDENT TESTS
  // ========================================================================
  console.log('\n👥 RESIDENT OPERATIONS\n');
  
  const test2 = await testAPI(
    'List Residents',
    'query { listResidents { items { id email name phone building floor unitNumber plate residentCode userId householdId createdAt updatedAt deletedAt } nextToken } }'
  );
  results.tests.push(test2);
  test2.success ? results.passed++ : results.failed++;

  const test3 = await testAPI(
    'Get Resident by ID',
    'query GetResident($id: ID!) { getResident(id: $id) { id email name residentCode } }',
    { id: 'resident_1789968329771_a7eecc' }
  );
  results.tests.push(test3);
  test3.success ? results.passed++ : results.failed++;

  // ========================================================================
  // 3. RESERVATION TESTS
  // ========================================================================
  console.log('\n🅿️ RESERVATION OPERATIONS\n');
  
  const test4 = await testAPI(
    'List Reservations',
    'query { listReservations { items { id residentId residentCode residentFloor residentPlate guestPlate guestMobile guestEmail startTime endTime status deletedAt createdAt } nextToken } }'
  );
  results.tests.push(test4);
  test4.success ? results.passed++ : results.failed++;

  // ========================================================================
  // 4. FIELD VALIDATION TESTS
  // ========================================================================
  console.log('\n🔍 FIELD VALIDATION TESTS\n');

  // Test if status field exists in Reservation
  const test5 = await testAPI(
    'Reservation with status field',
    'query { listReservations { items { id status } } }'
  );
  results.tests.push(test5);
  test5.success ? results.passed++ : results.failed++;

  // Test if deletedAt field exists in Reservation
  const test6 = await testAPI(
    'Reservation with deletedAt field',
    'query { listReservations { items { id deletedAt } } }'
  );
  results.tests.push(test6);
  test6.success ? results.passed++ : results.failed++;

  // Test if deletedAt field exists in Resident
  const test7 = await testAPI(
    'Resident with deletedAt field',
    'query { listResidents { items { id deletedAt } } }'
  );
  results.tests.push(test7);
  test7.success ? results.passed++ : results.failed++;

  // ========================================================================
  // 5. MUTATION INPUT VALIDATION
  // ========================================================================
  console.log('\n🔧 MUTATION INPUT VALIDATION\n');

  // Check if UpdateReservationInput accepts status (dry run)
  const test8 = await testAPI(
    'UpdateReservation with status field',
    `mutation { __type(name: "UpdateReservationInput") { name inputFields { name type { name kind } } } }`
  );
  results.tests.push(test8);
  test8.success ? results.passed++ : results.failed++;
  
  if (test8.success && test8.data.__type) {
    const hasStatus = test8.data.__type.inputFields.some(f => f.name === 'status');
    const hasDeletedAt = test8.data.__type.inputFields.some(f => f.name === 'deletedAt');
    log(hasStatus ? '✅' : '❌', `  UpdateReservationInput has 'status' field: ${hasStatus}`);
    log(hasDeletedAt ? '✅' : '❌', `  UpdateReservationInput has 'deletedAt' field: ${hasDeletedAt}`);
  }

  // ========================================================================
  // 6. CREATE RESERVATION TEST
  // ========================================================================
  console.log('\n📝 CREATE OPERATIONS\n');

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  
  const test9 = await testAPI(
    'Create Reservation (with validation)',
    `mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id residentCode guestPlate startTime endTime
      }
    }`,
    {
      input: {
        residentId: 'resident_1789968329771_a7eecc',
        residentCode: 'XTX8GA',
        guestPlate: 'TEST-' + Math.floor(Math.random() * 10000),
        guestMobile: '+15149876543',
        guestEmail: 'fulltest@example.com',
        startTime: now.toISOString(),
        endTime: oneHourLater.toISOString()
      }
    }
  );
  results.tests.push(test9);
  test9.success ? results.passed++ : results.failed++;

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total:  ${results.tests.length}`);
  console.log(`🎯 Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(70) + '\n');

  if (results.failed > 0) {
    console.log('⚠️  Some tests failed. Backend schema may not be deployed yet.');
    console.log('   Wait for Build #93 to complete and run tests again.\n');
  } else {
    console.log('🎉 All tests passed! API is fully functional.\n');
  }
}

runTests().catch(console.error);
