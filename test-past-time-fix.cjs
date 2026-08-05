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
  console.log('Testing past time fix...\n');

  // Get a resident first
  const residentsResult = await makeRequest(`query { listResidents { id residentCode unitNumber } }`);
  const resident = residentsResult.data.listResidents[0];
  
  console.log('Using resident:', resident.residentCode, 'Unit:', resident.unitNumber);

  // Test 1: Start time 2 minutes in past (should work)
  console.log('\n1. Testing with start time 2 minutes in past (should auto-adjust)...');
  const now = new Date();
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const result1 = await makeRequest(`
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        guestPlate
        startTime
      }
    }
  `, {
    input: {
      residentId: resident.id,
      residentCode: resident.residentCode,
      residentFloor: '1',
      residentPlate: 'TEST01',
      guestPlate: 'TEST' + Date.now().toString().slice(-5),
      guestMobile: '+14165551234',
      guestEmail: 'test@example.com',
      startTime: twoMinutesAgo.toISOString(),
      endTime: twoHoursLater.toISOString()
    }
  });

  if (result1.errors) {
    console.log('❌ Failed:', result1.errors[0].message);
  } else {
    console.log('✅ Success! Reservation created with adjusted start time');
    console.log('   Requested start:', twoMinutesAgo.toISOString());
    console.log('   Actual start:', result1.data.createReservation.startTime);
  }

  // Test 2: Start time 10 minutes in past (should fail)
  console.log('\n2. Testing with start time 10 minutes in past (should reject)...');
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);

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
      guestPlate: 'TEST' + Date.now().toString().slice(-5),
      guestMobile: '+14165551234',
      guestEmail: 'test@example.com',
      startTime: tenMinutesAgo.toISOString(),
      endTime: later.toISOString()
    }
  });

  if (result2.errors) {
    console.log('✅ Correctly rejected:', result2.errors[0].message);
  } else {
    console.log('❌ Should have rejected old start time');
  }

  console.log('\n✅ Tests complete!');
}

test().catch(console.error);
