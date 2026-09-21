const https = require('https');

// Use the PRODUCTION AppSync API
const API_URL = 'https://p6u7zkzkhrbuter3jhkvujkhpa.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-fakeyvtlvrdqjdwzmf6sqbzcoe'; // You need the actual API key for production

function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    
    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'da2-fakeyvtlvrdqjdwzmf6sqbzcoe',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('Raw response:', body);
        resolve(body);
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testSchema() {
  const query = `
    query ListResidents {
      listResidents {
        items {
          id
          email
          name
          deletedAt
        }
      }
    }
  `;
  
  await graphqlRequest(query);
}

testSchema();
