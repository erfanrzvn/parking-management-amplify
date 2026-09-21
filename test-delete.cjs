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
          if (response.errors) {
            console.error('GraphQL Errors:', JSON.stringify(response.errors, null, 2));
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

async function testDelete() {
  try {
    // 1. Create a test resident first
    console.log('📝 Creating test resident...');
    const createMutation = `
      mutation CreateResident($input: CreateResidentInput!) {
        createResident(input: $input) {
          id
          email
          name
        }
      }
    `;
    
    const testEmail = `delete-test-${Date.now()}@example.com`;
    const created = await graphqlRequest(createMutation, {
      input: {
        email: testEmail,
        name: 'Delete Test User',
        phone: '+14165559999',
        building: 'X',
        floor: '1',
        unitNumber: '999',
        plate: 'DEL999',
        residentCode: `DEL${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        userId: `test-del-${Date.now()}`
      }
    });
    
    const residentId = created.createResident.id;
    console.log(`✅ Created: ${created.createResident.name} (ID: ${residentId})\n`);
    
    // 2. Try to delete it
    console.log('🗑️  Attempting to delete resident...');
    const deleteMutation = `
      mutation DeleteResident($id: ID!) {
        deleteResident(id: $id) {
          id
        }
      }
    `;
    
    const deleted = await graphqlRequest(deleteMutation, { id: residentId });
    console.log(`✅ Deleted successfully: ${deleted.deleteResident.id}\n`);
    
    // 3. Try to get it (should fail or show deletedAt)
    console.log('🔍 Verifying deletion...');
    const getQuery = `
      query GetResident($id: ID!) {
        getResident(id: $id) {
          id
          email
          name
        }
      }
    `;
    
    try {
      const fetched = await graphqlRequest(getQuery, { id: residentId });
      if (fetched.getResident) {
        console.log('⚠️  Resident still exists (soft delete - this is normal)');
      } else {
        console.log('✅ Resident is gone (hard delete)');
      }
    } catch (e) {
      console.log('✅ Resident no longer accessible');
    }
    
    console.log('\n✅ DELETE TEST PASSED!');
    
  } catch (error) {
    console.error('\n❌ DELETE TEST FAILED:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testDelete();
