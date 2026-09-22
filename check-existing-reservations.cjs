const https = require('https');

const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

function makeRequest(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
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
  const query = `
    query ListReservations {
      listReservations(limit: 5) {
        items {
          id
          guestMobile
          guestEmail
          startTime
          endTime
        }
      }
    }
  `;

  console.log('📋 Checking existing reservations for phone format...\n');
  const result = await makeRequest(query);
  
  if (result.data?.listReservations?.items) {
    const items = result.data.listReservations.items.filter(i => i.guestMobile);
    console.log(`Found ${items.length} reservations with phone numbers:\n`);
    items.forEach((r, i) => {
      console.log(`${i + 1}. Mobile: ${r.guestMobile}`);
      console.log(`   Email: ${r.guestEmail}`);
      console.log('');
    });
  } else {
    console.log('❌ Error:', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
