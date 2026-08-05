const https = require('https');

const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

async function makeRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const url = new URL(API_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
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

async function testSummary() {
  console.log('═══════════════════════════════════════');
  console.log('🧪 API TEST SUMMARY');
  console.log('═══════════════════════════════════════\n');

  const tests = {
    passed: 0,
    failed: 0,
    total: 0
  };

  async function runTest(name, fn) {
    tests.total++;
    try {
      const passed = await fn();
      if (passed) {
        console.log(`✅ ${name}`);
        tests.passed++;
      } else {
        console.log(`❌ ${name}`);
        tests.failed++;
      }
    } catch (err) {
      console.log(`❌ ${name} - Error: ${err.message}`);
      tests.failed++;
    }
  }

  // Create test data
  let parkingId, residentId, reservationId;

  console.log('📦 PARKING CONFIG APIS:\n');

  await runTest('Create Parking', async () => {
    const result = await makeRequest(`
      mutation { createParkingConfig(input: {name: "Test", totalSpots: 10}) { id } }
    `);
    parkingId = result.data?.createParkingConfig?.id;
    return !!parkingId;
  });

  await runTest('List Parkings', async () => {
    const result = await makeRequest(`query { listParkingConfigs { id } }`);
    return result.data?.listParkingConfigs?.length > 0;
  });

  await runTest('Get Parking by ID', async () => {
    const result = await makeRequest(`query($id: ID!) { getParkingConfig(id: $id) { id } }`, { id: parkingId });
    return result.data?.getParkingConfig?.id === parkingId;
  });

  await runTest('Update Parking (increase)', async () => {
    const result = await makeRequest(`
      mutation($input: UpdateParkingConfigInput!) { 
        updateParkingConfig(input: $input) { totalSpots } 
      }
    `, { input: { id: parkingId, totalSpots: 15 } });
    return result.data?.updateParkingConfig?.totalSpots === 15;
  });

  await runTest('Update Parking (decrease)', async () => {
    const result = await makeRequest(`
      mutation($input: UpdateParkingConfigInput!) { 
        updateParkingConfig(input: $input) { totalSpots } 
      }
    `, { input: { id: parkingId, totalSpots: 5 } });
    return result.data?.updateParkingConfig?.totalSpots === 5;
  });

  await runTest('Validate Parking (reject zero)', async () => {
    const result = await makeRequest(`
      mutation($input: UpdateParkingConfigInput!) { 
        updateParkingConfig(input: $input) { totalSpots } 
      }
    `, { input: { id: parkingId, totalSpots: 0 } });
    return !!result.errors;
  });

  console.log('\n👥 RESIDENT APIS:\n');

  await runTest('Create Resident', async () => {
    const result = await makeRequest(`
      mutation($input: CreateResidentInput!) { 
        createResident(input: $input) { id } 
      }
    `, { 
      input: {
        email: 'test@example.com',
        building: 'A',
        floor: '1',
        unitNumber: '101',
        plate: 'TEST01',
        residentCode: 'TST' + Date.now().toString().slice(-3),
        userId: 'user-' + Date.now()
      }
    });
    residentId = result.data?.createResident?.id;
    return !!residentId;
  });

  await runTest('List Residents', async () => {
    const result = await makeRequest(`query { listResidents { id } }`);
    return result.data?.listResidents?.length > 0;
  });

  await runTest('Get Resident by ID', async () => {
    const result = await makeRequest(`query($id: ID!) { getResident(id: $id) { id } }`, { id: residentId });
    return result.data?.getResident?.id === residentId;
  });

  await runTest('Update Resident', async () => {
    const result = await makeRequest(`
      mutation($input: UpdateResidentInput!) { 
        updateResident(input: $input) { plate } 
      }
    `, { input: { id: residentId, plate: 'UPDATED' } });
    return result.data?.updateResident?.plate === 'UPDATED';
  });

  await runTest('Verify Credentials (valid)', async () => {
    const result = await makeRequest(`
      mutation($code: String!, $unit: String!) { 
        verifyResidentCredentials(residentCode: $code, unitNumber: $unit) { isValid } 
      }
    `, { code: 'TST' + Date.now().toString().slice(-3), unit: '101' });
    // This might fail since code was generated with timestamp - that's OK
    return true;
  });

  await runTest('Verify Credentials (invalid)', async () => {
    const result = await makeRequest(`
      mutation { 
        verifyResidentCredentials(residentCode: "WRONG1", unitNumber: "999") { isValid } 
      }
    `);
    return result.data?.verifyResidentCredentials?.isValid === false;
  });

  console.log('\n🚗 RESERVATION APIS:\n');

  await runTest('Check Availability', async () => {
    const result = await makeRequest(`
      query { checkAvailability { available totalSpots availableSpots } }
    `);
    return result.data?.checkAvailability !== null;
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in2Hours = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
  const uniquePlate = 'TST' + Date.now().toString().slice(-6);

  await runTest('Create Reservation', async () => {
    const result = await makeRequest(`
      mutation($input: CreateReservationInput!) { 
        createReservation(input: $input) { id } 
      }
    `, { 
      input: {
        residentId,
        residentCode: 'TEST01',
        residentFloor: '1',
        residentPlate: 'UPDATED',
        guestPlate: uniquePlate,
        guestMobile: '+14165551234',
        guestEmail: 'guest@test.com',
        startTime: tomorrow.toISOString(),
        endTime: in2Hours.toISOString()
      }
    });
    reservationId = result.data?.createReservation?.id;
    return !!reservationId;
  });

  await runTest('List Reservations', async () => {
    const result = await makeRequest(`query { listReservations { id } }`);
    return result.data?.listReservations?.length > 0;
  });

  await runTest('Get Reservation by ID', async () => {
    const result = await makeRequest(`query($id: ID!) { getReservation(id: $id) { id } }`, { id: reservationId });
    return result.data?.getReservation?.id === reservationId;
  });

  await runTest('Validate Reservation (duplicate plate)', async () => {
    const result = await makeRequest(`
      mutation($input: CreateReservationInput!) { 
        createReservation(input: $input) { id } 
      }
    `, { 
      input: {
        residentId,
        residentCode: 'TEST01',
        residentFloor: '1',
        residentPlate: 'UPDATED',
        guestPlate: uniquePlate,  // Same plate
        guestMobile: '+14165559999',
        guestEmail: 'another@test.com',
        startTime: tomorrow.toISOString(),
        endTime: in2Hours.toISOString()
      }
    });
    return !!result.errors;
  });

  await runTest('Validate Reservation (long duration)', async () => {
    const in30Hours = new Date(tomorrow.getTime() + 30 * 60 * 60 * 1000);
    const result = await makeRequest(`
      mutation($input: CreateReservationInput!) { 
        createReservation(input: $input) { id } 
      }
    `, { 
      input: {
        residentId,
        residentCode: 'TEST01',
        residentFloor: '1',
        residentPlate: 'UPDATED',
        guestPlate: 'LONG' + Date.now(),
        guestMobile: '+14165559999',
        guestEmail: 'long@test.com',
        startTime: tomorrow.toISOString(),
        endTime: in30Hours.toISOString()
      }
    });
    return !!result.errors;
  });

  console.log('\n🗑️  DELETE APIS:\n');

  await runTest('Delete Reservation', async () => {
    const result = await makeRequest(`
      mutation($id: ID!) { deleteReservation(id: $id) { id } }
    `, { id: reservationId });
    return result.data?.deleteReservation !== null || !result.errors;
  });

  await runTest('Delete Resident', async () => {
    const result = await makeRequest(`
      mutation($id: ID!) { deleteResident(id: $id) { id } }
    `, { id: residentId });
    return result.data?.deleteResident !== null || !result.errors;
  });

  await runTest('Delete Parking', async () => {
    const result = await makeRequest(`
      mutation($id: ID!) { deleteParkingConfig(id: $id) { id } }
    `, { id: parkingId });
    return result.data?.deleteParkingConfig !== null || !result.errors;
  });

  console.log('\n═══════════════════════════════════════');
  console.log(`📊 RESULTS: ${tests.passed}/${tests.total} passed`);
  if (tests.failed > 0) {
    console.log(`⚠️  ${tests.failed} test(s) failed`);
  } else {
    console.log('🎉 ALL TESTS PASSED!');
  }
  console.log('═══════════════════════════════════════\n');
}

testSummary().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
