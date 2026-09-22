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
      listReservations(limit: 100) {
        items {
          id
          residentCode
          guestPlate
          status
          startTime
          endTime
          createdAt
        }
      }
    }
  `;

  console.log('📋 Listing all active reservations...\n');
  const result = await makeRequest(query);
  
  if (result.data?.listReservations?.items) {
    const now = new Date();
    const active = result.data.listReservations.items.filter(r => 
      new Date(r.endTime) > now && (!r.status || r.status !== 'CANCELLED')
    );
    
    console.log(`Found ${active.length} active reservations:\n`);
    active.forEach((r, i) => {
      const end = new Date(r.endTime);
      const remaining = Math.round((end - now) / (1000 * 60)); // minutes
      console.log(`${i + 1}. ${r.residentCode} - ${r.guestPlate}`);
      console.log(`   ID: ${r.id}`);
      console.log(`   Ends: ${r.endTime.split('T')[0]} ${r.endTime.split('T')[1].substring(0,5)}`);
      console.log(`   Remaining: ${remaining} minutes`);
      console.log('');
    });
  } else {
    console.log('❌ Error:', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
