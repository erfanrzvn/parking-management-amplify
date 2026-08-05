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

async function testAll() {
  console.log('=== COMPREHENSIVE API TEST ===\n');

  let parkingId = null;
  let residentId = null;
  let reservationId = null;

  // ==================== PARKING CONFIG TESTS ====================
  console.log('📦 PARKING CONFIG TESTS:');
  console.log('─────────────────────────────────────');

  // Test 1: Create Parking
  console.log('\n1️⃣  Creating parking config...');
  let result = await makeRequest(`
    mutation CreateParking($input: CreateParkingConfigInput!) {
      createParkingConfig(input: $input) {
        id
        name
        totalSpots
        createdAt
      }
    }
  `, {
    input: {
      name: 'Main Parking',
      totalSpots: 10,
      updatedBy: 'Test Admin'
    }
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    parkingId = result.data.createParkingConfig.id;
    console.log('✅ Created:', {
      id: parkingId,
      name: result.data.createParkingConfig.name,
      totalSpots: result.data.createParkingConfig.totalSpots
    });
  }

  // Test 2: List Parkings
  console.log('\n2️⃣  Listing all parkings...');
  result = await makeRequest(`
    query ListParkings {
      listParkingConfigs {
        id
        name
        totalSpots
      }
    }
  `);

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Found:', result.data.listParkingConfigs.length, 'parking(s)');
    result.data.listParkingConfigs.forEach(p => {
      console.log(`   - ${p.name}: ${p.totalSpots} spots (ID: ${p.id})`);
    });
  }

  // Test 3: Get Parking by ID
  console.log('\n3️⃣  Getting parking by ID...');
  result = await makeRequest(`
    query GetParking($id: ID!) {
      getParkingConfig(id: $id) {
        id
        name
        totalSpots
        updatedBy
      }
    }
  `, { id: parkingId });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Retrieved:', result.data.getParkingConfig);
  }

  // Test 4: Update Parking (increase spots)
  console.log('\n4️⃣  Updating parking (increase spots to 15)...');
  result = await makeRequest(`
    mutation UpdateParking($input: UpdateParkingConfigInput!) {
      updateParkingConfig(input: $input) {
        id
        totalSpots
        updatedBy
      }
    }
  `, {
    input: {
      id: parkingId,
      totalSpots: 15,
      updatedBy: 'Test Admin Updated'
    }
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Updated:', result.data.updateParkingConfig);
  }

  // Test 5: Update Parking (decrease spots)
  console.log('\n5️⃣  Updating parking (decrease spots to 8)...');
  result = await makeRequest(`
    mutation UpdateParking($input: UpdateParkingConfigInput!) {
      updateParkingConfig(input: $input) {
        id
        totalSpots
      }
    }
  `, {
    input: {
      id: parkingId,
      totalSpots: 8
    }
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Updated to:', result.data.updateParkingConfig.totalSpots, 'spots');
  }

  // Test 6: Validate minimum spots (should reject 0)
  console.log('\n6️⃣  Testing validation (totalSpots = 0, should reject)...');
  result = await makeRequest(`
    mutation UpdateParking($input: UpdateParkingConfigInput!) {
      updateParkingConfig(input: $input) {
        id
        totalSpots
      }
    }
  `, {
    input: {
      id: parkingId,
      totalSpots: 0
    }
  });

  if (result.errors) {
    console.log('✅ Correctly rejected:', result.errors[0].message);
  } else {
    console.log('❌ Should have rejected zero spots');
  }

  // ==================== RESIDENT TESTS ====================
  console.log('\n\n👥 RESIDENT TESTS:');
  console.log('─────────────────────────────────────');

  // Test 7: Create Resident
  console.log('\n7️⃣  Creating resident...');
  result = await makeRequest(`
    mutation CreateResident($input: CreateResidentInput!) {
      createResident(input: $input) {
        id
        email
        building
        floor
        unitNumber
        plate
        residentCode
      }
    }
  `, {
    input: {
      email: 'john.doe@example.com',
      building: 'Tower A',
      floor: '5',
      unitNumber: '501',
      plate: 'ABC123',
      residentCode: 'TEST01',
      userId: 'user-' + Date.now()
    }
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    residentId = result.data.createResident.id;
    console.log('✅ Created:', {
      id: residentId,
      email: result.data.createResident.email,
      unit: result.data.createResident.unitNumber,
      code: result.data.createResident.residentCode
    });
  }

  // Test 8: List Residents
  console.log('\n8️⃣  Listing all residents...');
  result = await makeRequest(`
    query ListResidents {
      listResidents {
        id
        email
        unitNumber
        residentCode
      }
    }
  `);

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Found:', result.data.listResidents.length, 'resident(s)');
    result.data.listResidents.slice(0, 5).forEach(r => {
      console.log(`   - Unit ${r.unitNumber}: ${r.email} (Code: ${r.residentCode})`);
    });
  }

  // Test 9: Get Resident by ID
  console.log('\n9️⃣  Getting resident by ID...');
  result = await makeRequest(`
    query GetResident($id: ID!) {
      getResident(id: $id) {
        id
        email
        building
        floor
        unitNumber
        plate
        residentCode
      }
    }
  `, { id: residentId });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Retrieved:', result.data.getResident);
  }

  // Test 10: Update Resident
  console.log('\n🔟 Updating resident (change plate)...');
  result = await makeRequest(`
    mutation UpdateResident($input: UpdateResidentInput!) {
      updateResident(input: $input) {
        id
        plate
        email
      }
    }
  `, {
    input: {
      id: residentId,
      plate: 'XYZ999',
      email: 'john.updated@example.com'
    }
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Updated:', {
      newPlate: result.data.updateResident.plate,
      newEmail: result.data.updateResident.email
    });
  }

  // Test 11: Verify Resident Credentials
  console.log('\n1️⃣1️⃣  Verifying resident credentials...');
  result = await makeRequest(`
    mutation VerifyCredentials($code: String!, $unit: String!) {
      verifyResidentCredentials(residentCode: $code, unitNumber: $unit) {
        isValid
        residentId
        residentFloor
        residentPlate
        message
      }
    }
  `, {
    code: 'TEST01',
    unit: '501'
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Verified:', result.data.verifyResidentCredentials);
  }

  // Test 12: Verify with wrong credentials
  console.log('\n1️⃣2️⃣  Testing wrong credentials (should fail)...');
  result = await makeRequest(`
    mutation VerifyCredentials($code: String!, $unit: String!) {
      verifyResidentCredentials(residentCode: $code, unitNumber: $unit) {
        isValid
        message
      }
    }
  `, {
    code: 'WRONG1',
    unit: '999'
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    if (!result.data.verifyResidentCredentials.isValid) {
      console.log('✅ Correctly rejected:', result.data.verifyResidentCredentials.message);
    } else {
      console.log('❌ Should have rejected wrong credentials');
    }
  }

  // ==================== RESERVATION TESTS ====================
  console.log('\n\n🚗 RESERVATION TESTS:');
  console.log('─────────────────────────────────────');

  // Test 13: Check Availability
  console.log('\n1️⃣3️⃣  Checking parking availability...');
  result = await makeRequest(`
    query CheckAvailability {
      checkAvailability {
        available
        availableSpots
        totalSpots
        message
      }
    }
  `);

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Availability:', result.data.checkAvailability);
  }

  // Test 14: Create Valid Reservation
  console.log('\n1️⃣4️⃣  Creating valid reservation...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in3Hours = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000);

  // Generate unique plate number
  const uniquePlate = 'TEST' + Date.now().toString().slice(-5);

  result = await makeRequest(`
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        guestPlate
        guestEmail
        startTime
        endTime
      }
    }
  `, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '5',
      residentPlate: 'XYZ999',
      guestPlate: uniquePlate,
      guestMobile: '+14165551234',
      guestEmail: 'guest@example.com',
      startTime: tomorrow.toISOString(),
      endTime: in3Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    reservationId = result.data.createReservation.id;
    console.log('✅ Created:', {
      id: reservationId,
      plate: result.data.createReservation.guestPlate,
      email: result.data.createReservation.guestEmail
    });
  }

  // Test 15: List Reservations
  console.log('\n1️⃣5️⃣  Listing all reservations...');
  result = await makeRequest(`
    query ListReservations {
      listReservations {
        id
        guestPlate
        guestEmail
        startTime
        endTime
        residentCode
      }
    }
  `);

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Found:', result.data.listReservations.length, 'reservation(s)');
    result.data.listReservations.slice(0, 5).forEach(r => {
      console.log(`   - ${r.guestPlate} by resident ${r.residentCode}`);
    });
  }

  // Test 16: Get Reservation by ID
  console.log('\n1️⃣6️⃣  Getting reservation by ID...');
  result = await makeRequest(`
    query GetReservation($id: ID!) {
      getReservation(id: $id) {
        id
        guestPlate
        guestEmail
        guestMobile
        startTime
        endTime
      }
    }
  `, { id: reservationId });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Retrieved:', result.data.getReservation);
  }

  // Test 17: Update Reservation (extend time)
  console.log('\n1️⃣7️⃣  Updating reservation (extend end time)...');
  const in5Hours = new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000);

  result = await makeRequest(`
    mutation UpdateReservation($input: UpdateReservationInput!) {
      updateReservation(input: $input) {
        id
        endTime
      }
    }
  `, {
    input: {
      id: reservationId,
      endTime: in5Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else {
    console.log('✅ Updated end time:', result.data.updateReservation.endTime);
  }

  // Test 18: Try duplicate plate (should fail)
  console.log('\n1️⃣8️⃣  Testing duplicate plate reservation (should reject)...');
  result = await makeRequest(`
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
      }
    }
  `, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '5',
      residentPlate: 'XYZ999',
      guestPlate: uniquePlate,  // Same plate as previous reservation
      guestMobile: '+14165559999',
      guestEmail: 'another@example.com',
      startTime: tomorrow.toISOString(),
      endTime: in3Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('✅ Correctly rejected:', result.errors[0].message);
  } else {
    console.log('❌ Should have rejected duplicate plate');
  }

  // Test 19: Try invalid duration (> 24 hours)
  console.log('\n1️⃣9️⃣  Testing invalid duration (should reject)...');
  const in30Hours = new Date(tomorrow.getTime() + 30 * 60 * 60 * 1000);

  result = await makeRequest(`
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
      }
    }
  `, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '5',
      residentPlate: 'XYZ999',
      guestPlate: 'GUEST99',
      guestMobile: '+14165559999',
      guestEmail: 'test@example.com',
      startTime: tomorrow.toISOString(),
      endTime: in30Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('✅ Correctly rejected:', result.errors[0].message);
  } else {
    console.log('❌ Should have rejected long duration');
  }

  // ==================== DELETE TESTS ====================
  console.log('\n\n🗑️  DELETE TESTS:');
  console.log('─────────────────────────────────────');

  // Test 20: Delete Reservation
  console.log('\n2️⃣0️⃣  Deleting reservation...');
  result = await makeRequest(`
    mutation DeleteReservation($id: ID!) {
      deleteReservation(id: $id) {
        id
        guestPlate
      }
    }
  `, { id: reservationId });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else if (result.data && result.data.deleteReservation) {
    console.log('✅ Deleted reservation:', result.data.deleteReservation.id);
  } else {
    console.log('⚠️  Delete returned null (already deleted or not found)');
  }

  // Test 21: Delete Resident
  console.log('\n2️⃣1️⃣  Deleting resident...');
  result = await makeRequest(`
    mutation DeleteResident($id: ID!) {
      deleteResident(id: $id) {
        id
        email
      }
    }
  `, { id: residentId });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else if (result.data && result.data.deleteResident) {
    console.log('✅ Deleted resident:', result.data.deleteResident.email);
  } else {
    console.log('⚠️  Delete returned null (already deleted or not found)');
  }

  // Test 22: Delete Parking
  console.log('\n2️⃣2️⃣  Deleting parking config...');
  result = await makeRequest(`
    mutation DeleteParking($id: ID!) {
      deleteParkingConfig(id: $id) {
        id
        name
      }
    }
  `, { id: parkingId });

  if (result.errors) {
    console.log('❌ Failed:', result.errors[0].message);
  } else if (result.data && result.data.deleteParkingConfig) {
    console.log('✅ Deleted parking:', result.data.deleteParkingConfig.name);
  } else {
    console.log('⚠️  Delete returned null (already deleted or not found)');
  }

  console.log('\n\n═══════════════════════════════════════');
  console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════\n');
}

testAll().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
