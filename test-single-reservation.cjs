const https = require('https');

const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

function makeRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(API_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  // Test با یک رزرو ساده - 2 ساعت در آینده
  const now = new Date();
  const startTime = new Date(now.getTime() + 2*3600000); // 2 ساعت بعد
  const endTime = new Date(startTime.getTime() + 2*3600000); // 2 ساعت duration
  
  const query = `
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        residentCode
        guestPlate
        startTime
        endTime
        status
      }
    }
  `;

  const variables = {
    input: {
      residentId: '3342783e-295c-4b88-8f03-efe4e84e8312', // Erfan
      residentCode: 'ZXS537',
      residentFloor: '6',
      residentPlate: 'ABC-123',
      guestPlate: 'TEST-GUEST',
      guestMobile: '+15149876543',
      guestEmail: 'testguest@example.com',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    }
  };

  console.log('🧪 Testing single reservation...');
  console.log('Start:', startTime.toISOString());
  console.log('End:', endTime.toISOString());
  console.log('Duration: 2 hours\n');

  const result = await makeRequest(query, variables);
  
  if (result.data?.createReservation) {
    console.log('✅ SUCCESS!');
    console.log(JSON.stringify(result.data.createReservation, null, 2));
  } else {
    console.log('❌ FAILED');
    console.log(JSON.stringify(result.errors, null, 2));
  }
}

main().catch(console.error);
