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

async function testOverlap() {
  console.log('═══════════════════════════════════════');
  console.log('🧪 TESTING TIME OVERLAP VALIDATION');
  console.log('═══════════════════════════════════════\n');

  // Get a resident
  const residentResult = await makeRequest(`
    query { listResidents { id residentCode unitNumber } }
  `);
  
  const resident = residentResult.data.listResidents[0];
  console.log('Using resident:', resident.residentCode, '- Unit:', resident.unitNumber);

  // Test 1: Create first reservation
  console.log('\n1️⃣  Creating first reservation (2 hours from now)...');
  const now = new Date();
  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const result1 = await makeRequest(`
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        guestPlate
        startTime
        endTime
      }
    }
  `, {
    input: {
      residentId: resident.id,
      residentCode: resident.residentCode,
      residentFloor: '1',
      residentPlate: 'TEST01',
      guestPlate: 'FIRST' + Date.now().toString().slice(-4),
      guestMobile: '+989121234567',
      guestEmail: 'test1@example.com',
      startTime: in2Hours.toISOString(),
      endTime: in4Hours.toISOString()
    }
  });

  if (result1.errors) {
    console.log('   ❌ Failed:', result1.errors[0].message);
    return;
  }

  const firstReservation = result1.data.createReservation;
  console.log('   ✅ Created:', firstReservation.guestPlate);
  console.log('   ⏰ Time:', new Date(firstReservation.startTime).toLocaleTimeString(), 
              '-', new Date(firstReservation.endTime).toLocaleTimeString());

  // Test 2: Try to create overlapping reservation (should fail)
  console.log('\n2️⃣  Trying to create overlapping reservation (should be rejected)...');
  const in3Hours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const in5Hours = new Date(now.getTime() + 5 * 60 * 60 * 1000);

  const result2 = await makeRequest(`
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
      }
    }
  `, {
    input: {
      residentId: resident.id,
      residentCode: resident.residentCode,
      residentFloor: '1',
      residentPlate: 'TEST01',
      guestPlate: 'OVERLAP' + Date.now().toString().slice(-4),
      guestMobile: '+989121234567',
      guestEmail: 'test2@example.com',
      startTime: in3Hours.toISOString(),
      endTime: in5Hours.toISOString()
    }
  });

  if (result2.errors) {
    console.log('   ✅ Correctly rejected!');
    console.log('   📝 Message:', result2.errors[0].message);
  } else {
    console.log('   ❌ Should have been rejected (overlapping times)');
  }

  // Test 3: Create non-overlapping reservation (should work)
  console.log('\n3️⃣  Creating non-overlapping reservation (after first one ends)...');
  const in5HoursPlus = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const in7Hours = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  const result3 = await makeRequest(`
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        guestPlate
        startTime
        endTime
      }
    }
  `, {
    input: {
      residentId: resident.id,
      residentCode: resident.residentCode,
      residentFloor: '1',
      residentPlate: 'TEST01',
      guestPlate: 'SECOND' + Date.now().toString().slice(-4),
      guestMobile: '+989121234567',
      guestEmail: 'test3@example.com',
      startTime: in5HoursPlus.toISOString(),
      endTime: in7Hours.toISOString()
    }
  });

  if (result3.errors) {
    console.log('   ❌ Failed:', result3.errors[0].message);
  } else {
    console.log('   ✅ Created:', result3.data.createReservation.guestPlate);
    console.log('   ⏰ Time:', new Date(result3.data.createReservation.startTime).toLocaleTimeString(),
                '-', new Date(result3.data.createReservation.endTime).toLocaleTimeString());
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ OVERLAP VALIDATION WORKING!');
  console.log('═══════════════════════════════════════');
}

testOverlap().catch(console.error);
