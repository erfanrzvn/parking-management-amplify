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
  // Get all residents
  const residentsQuery = `
    query ListResidents {
      listResidents {
        items {
          id
          name
          residentCode
          floor
          plate
          building
          unitNumber
        }
      }
    }
  `;

  // Get all reservations
  const reservationsQuery = `
    query ListReservations {
      listReservations(limit: 100) {
        items {
          residentCode
          status
          endTime
        }
      }
    }
  `;

  console.log('🔍 Finding residents without active reservations...\n');
  
  const [residentsResult, reservationsResult] = await Promise.all([
    makeRequest(residentsQuery),
    makeRequest(reservationsQuery)
  ]);

  const residents = residentsResult.data?.listResidents?.items || [];
  const reservations = reservationsResult.data?.listReservations?.items || [];
  
  // Get active reservation codes
  const now = new Date();
  const activeResCodes = new Set(
    reservations
      .filter(r => new Date(r.endTime) > now && (!r.status || r.status !== 'CANCELLED'))
      .map(r => r.residentCode)
  );

  // Find residents without active reservations
  const availableResidents = residents.filter(r => 
    r.residentCode && 
    r.name && 
    r.floor && 
    r.plate &&
    !activeResCodes.has(r.residentCode)
  );

  console.log(`📋 Total Residents: ${residents.length}`);
  console.log(`🅿️ Active Reservations: ${activeResCodes.size}`);
  console.log(`✅ Available for Booking: ${availableResidents.length}\n`);
  console.log('='.repeat(60));
  
  availableResidents.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.name}`);
    console.log(`   Resident Code: ${r.residentCode}`);
    console.log(`   Building: ${r.building || 'N/A'}`);
    console.log(`   Floor: ${r.floor} | Unit: ${r.unitNumber || 'N/A'}`);
    console.log(`   Plate: ${r.plate}`);
    console.log(`   ID: ${r.id}`);
  });
  
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
