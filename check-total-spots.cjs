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
    query ListParkingConfigs {
      listParkingConfigs {
        id
        name
        totalSpots
      }
    }
  `;

  console.log('📊 Checking parking config...\n');
  const result = await makeRequest(query);
  
  if (result.data?.listParkingConfigs) {
    const configs = result.data.listParkingConfigs;
    console.log(`Found ${configs.length} config(s):\n`);
    configs.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}`);
      console.log(`   Total Spots: ${c.totalSpots}`);
      console.log(`   ID: ${c.id}`);
      console.log('');
    });
    
    // Get active reservations count
    const resQuery = `
      query ListReservations {
        listReservations(limit: 100) {
          items {
            id
            status
            endTime
          }
        }
      }
    `;
    
    const resResult = await makeRequest(resQuery);
    const now = new Date().toISOString();
    const activeRes = resResult.data?.listReservations?.items.filter(r => 
      r.endTime > now && (!r.status || r.status !== 'CANCELLED')
    ) || [];
    
    console.log(`\n📋 Active Reservations: ${activeRes.length}`);
    console.log(`🅿️ Available Spots: ${configs[0].totalSpots - activeRes.length}`);
  } else {
    console.log('❌ Error:', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
