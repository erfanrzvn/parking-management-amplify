const https = require('https');

const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

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
        'x-api-key': API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          console.log('Full response:', JSON.stringify(response, null, 2));
          if (response.errors) {
            reject(new Error(response.errors[0]?.message || 'GraphQL error'));
          } else {
            resolve(response.data);
          }
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

async function testCancel() {
  try {
    // List reservations first
    const listQuery = `
      query {
        listReservations {
          items {
            id
            guestPlate
            status
          }
        }
      }
    `;
    
    const list = await graphqlRequest(listQuery);
    console.log('Active reservations:', list.listReservations.items.length);
    
    if (list.listReservations.items.length > 0) {
      const firstRes = list.listReservations.items[0];
      console.log(`\nTrying to cancel: ${firstRes.guestPlate} (${firstRes.id})\n`);
      
      const cancelMutation = `
        mutation CancelReservation($id: ID!) {
          cancelReservation(id: $id) {
            id
            status
            deletedAt
          }
        }
      `;
      
      const result = await graphqlRequest(cancelMutation, { id: firstRes.id });
      console.log('✅ Cancel successful!', result);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCancel();
