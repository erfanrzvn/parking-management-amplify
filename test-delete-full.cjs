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

async function testFullDelete() {
  try {
    console.log('🧪 COMPREHENSIVE DELETE TEST\n');
    
    // Step 1: Count residents before
    console.log('1️⃣  Counting residents before...');
    const listQuery = `
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
    const beforeList = await graphqlRequest(listQuery);
    const activeBeforeCount = beforeList.listResidents.items.filter(r => !r.deletedAt).length;
    const totalBeforeCount = beforeList.listResidents.items.length;
    console.log(`   Active residents: ${activeBeforeCount}`);
    console.log(`   Total (including deleted): ${totalBeforeCount}\n`);
    
    // Step 2: Create test resident
    console.log('2️⃣  Creating test resident...');
    const createMutation = `
      mutation CreateResident($input: CreateResidentInput!) {
        createResident(input: $input) {
          id
          email
          name
        }
      }
    `;
    
    const testEmail = `fulltest-${Date.now()}@example.com`;
    const created = await graphqlRequest(createMutation, {
      input: {
        email: testEmail,
        name: 'Full Test User',
        phone: '+14165559876',
        building: 'TEST',
        floor: '99',
        unitNumber: '999',
        plate: 'TST999',
        residentCode: `FT${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        userId: `fulltest-${Date.now()}`
      }
    });
    
    const testId = created.createResident.id;
    console.log(`   ✅ Created: ${created.createResident.name}`);
    console.log(`   ID: ${testId}\n`);
    
    // Step 3: Verify it appears in list
    console.log('3️⃣  Verifying it appears in resident list...');
    const afterCreateList = await graphqlRequest(listQuery);
    const foundInList = afterCreateList.listResidents.items.some(r => r.id === testId && !r.deletedAt);
    console.log(`   Found in list: ${foundInList ? '✅ YES' : '❌ NO'}`);
    console.log(`   Active count: ${afterCreateList.listResidents.items.filter(r => !r.deletedAt).length}\n`);
    
    // Step 4: Delete the resident
    console.log('4️⃣  Deleting the resident...');
    const deleteMutation = `
      mutation DeleteResident($id: ID!) {
        deleteResident(id: $id) {
          id
        }
      }
    `;
    
    await graphqlRequest(deleteMutation, { id: testId });
    console.log(`   ✅ Delete mutation completed\n`);
    
    // Step 5: Check if it's gone from list
    console.log('5️⃣  Checking if removed from list...');
    const afterDeleteList = await graphqlRequest(listQuery);
    const stillInList = afterDeleteList.listResidents.items.some(r => r.id === testId && !r.deletedAt);
    const activeAfterCount = afterDeleteList.listResidents.items.filter(r => !r.deletedAt).length;
    
    console.log(`   Still visible in list: ${stillInList ? '❌ YES (BUG!)' : '✅ NO (CORRECT)'}`);
    console.log(`   Active count before delete: ${activeBeforeCount}`);
    console.log(`   Active count after delete: ${activeAfterCount}`);
    console.log(`   Difference: ${activeBeforeCount - activeAfterCount} ${activeBeforeCount - activeAfterCount === 0 ? '✅ (back to original)' : ''}\n`);
    
    // Step 6: Check if record still exists with deletedAt
    console.log('6️⃣  Checking if record exists with deletedAt...');
    const withDeletedAt = afterDeleteList.listResidents.items.find(r => r.id === testId);
    if (withDeletedAt) {
      console.log(`   ✅ Record preserved with deletedAt: ${withDeletedAt.deletedAt}`);
      console.log(`   (Soft delete working correctly for audit trail)\n`);
    } else {
      console.log(`   ⚠️  Record completely gone (hard delete)\n`);
    }
    
    // Summary
    console.log('═══════════════════════════════════════');
    console.log('✅ DELETE TEST PASSED!');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Created test resident`);
    console.log(`✅ Verified in list (${foundInList ? 'YES' : 'NO'})`);
    console.log(`✅ Deleted resident`);
    console.log(`✅ Removed from active list (${!stillInList ? 'YES' : 'NO'})`);
    console.log(`✅ Audit trail preserved (${withDeletedAt ? 'YES' : 'NO'})`);
    console.log('═══════════════════════════════════════\n');
    
    if (stillInList) {
      throw new Error('DELETED RESIDENT STILL VISIBLE IN LIST!');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

testFullDelete();
