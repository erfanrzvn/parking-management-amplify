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
  // Check Reservation type fields
  const query = `
    {
      __type(name: "Reservation") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  console.log('🔍 Checking Reservation type schema...\n');
  const result = await makeRequest(query);
  
  if (result.data?.__type) {
    console.log('✅ Reservation fields:');
    result.data.__type.fields.forEach(field => {
      const typeName = field.type.name || field.type.ofType?.name || 'Unknown';
      console.log(`   - ${field.name}: ${typeName}`);
    });
  } else {
    console.log('❌ Error:', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
