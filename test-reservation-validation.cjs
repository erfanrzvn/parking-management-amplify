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

async function test() {
  console.log('=== Testing Backend Validation ===\n');

  // Test 1: Create a test resident first
  console.log('1. Creating test resident...');
  const createResidentMutation = `
    mutation CreateResident($input: CreateResidentInput!) {
      createResident(input: $input) {
        id
        residentCode
        unitNumber
      }
    }
  `;

  const residentResult = await makeRequest(createResidentMutation, {
    input: {
      email: 'test@example.com',
      building: 'A',
      floor: '2',
      unitNumber: '201',
      plate: 'ABC123',
      residentCode: 'TEST01',
      userId: 'test-user-' + Date.now()
    }
  });

  if (residentResult.errors) {
    console.log('❌ Failed to create resident:', residentResult.errors[0].message);
    return;
  }

  const residentId = residentResult.data.createResident.id;
  console.log('✅ Resident created:', residentId);

  // Test 2: Invalid duration (> 24 hours)
  console.log('\n2. Testing invalid duration (> 24 hours)...');
  const createReservationMutation = `
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        guestPlate
      }
    }
  `;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in2Days = new Date();
  in2Days.setDate(in2Days.getDate() + 3);

  let result = await makeRequest(createReservationMutation, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '2',
      residentPlate: 'ABC123',
      guestPlate: 'XYZ789',
      guestMobile: '+14165551234',
      guestEmail: 'guest@example.com',
      startTime: tomorrow.toISOString(),
      endTime: in2Days.toISOString()
    }
  });

  if (result.errors) {
    console.log('✅ Correctly rejected:', result.errors[0].message);
  } else {
    console.log('❌ Should have rejected long duration');
  }

  // Test 3: Invalid email format
  console.log('\n3. Testing invalid email format...');
  const in2Hours = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

  result = await makeRequest(createReservationMutation, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '2',
      residentPlate: 'ABC123',
      guestPlate: 'XYZ789',
      guestMobile: '+14165551234',
      guestEmail: 'invalid-email',
      startTime: tomorrow.toISOString(),
      endTime: in2Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('✅ Correctly rejected:', result.errors[0].message);
  } else {
    console.log('❌ Should have rejected invalid email');
  }

  // Test 4: Invalid phone format
  console.log('\n4. Testing invalid phone format...');
  result = await makeRequest(createReservationMutation, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '2',
      residentPlate: 'ABC123',
      guestPlate: 'XYZ789',
      guestMobile: '123',
      guestEmail: 'guest@example.com',
      startTime: tomorrow.toISOString(),
      endTime: in2Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('✅ Correctly rejected:', result.errors[0].message);
  } else {
    console.log('❌ Should have rejected invalid phone');
  }

  // Test 5: Valid reservation
  console.log('\n5. Testing valid reservation...');
  result = await makeRequest(createReservationMutation, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '2',
      residentPlate: 'ABC123',
      guestPlate: 'VALID01',
      guestMobile: '+14165551234',
      guestEmail: 'guest@example.com',
      startTime: tomorrow.toISOString(),
      endTime: in2Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('❌ Should have accepted valid reservation:', result.errors[0].message);
  } else {
    console.log('✅ Valid reservation created:', result.data.createReservation.id);
  }

  // Test 6: Duplicate plate
  console.log('\n6. Testing duplicate plate (should reject)...');
  result = await makeRequest(createReservationMutation, {
    input: {
      residentId: residentId,
      residentCode: 'TEST01',
      residentFloor: '2',
      residentPlate: 'ABC123',
      guestPlate: 'VALID01',
      guestMobile: '+14165559999',
      guestEmail: 'another@example.com',
      startTime: tomorrow.toISOString(),
      endTime: in2Hours.toISOString()
    }
  });

  if (result.errors) {
    console.log('✅ Correctly rejected duplicate:', result.errors[0].message);
  } else {
    console.log('❌ Should have rejected duplicate plate');
  }

  console.log('\n=== Tests Complete ===');
}

test().catch(console.error);
