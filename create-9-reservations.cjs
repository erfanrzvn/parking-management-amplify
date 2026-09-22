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

async function createReservation(residentId, residentCode, residentFloor, residentPlate, guestPlate, guestMobile, guestEmail, startDateTime, endDateTime) {
  const query = `
    mutation CreateReservation($input: CreateReservationInput!) {
      createReservation(input: $input) {
        id
        residentId
        residentCode
        residentFloor
        residentPlate
        guestPlate
        guestMobile
        guestEmail
        startTime
        endTime
        status
        createdAt
      }
    }
  `;

  const variables = {
    input: {
      residentId,
      residentCode,
      residentFloor,
      residentPlate,
      guestPlate,
      guestMobile,
      guestEmail,
      startTime: startDateTime,
      endTime: endDateTime
    }
  };

  return makeRequest(query, variables);
}

async function main() {
  console.log('🚀 Creating 9 reservations for all parking spots...\n');

  // رزروها با ID های واقعی - endTime = now + 2 ساعت
  const now = new Date();
  
  const reservations = [
    { 
      id: '3342783e-295c-4b88-8f03-efe4e84e8312', // Erfan Rezvani
      code: 'ZXS537', 
      floor: '6', 
      plate: 'ABC-123', 
      guest: 'GUEST-001', 
      mobile: '+15149876541', 
      email: 'guest1@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(), // now + 2 ساعت
      name: 'Erfan Rezvani' 
    },
    { 
      id: '328c718b-31aa-47bb-97d5-b599f36e6d0a', // Mike Johnson
      code: 'MJO123', 
      floor: '12', 
      plate: 'QRS-123', 
      guest: 'GUEST-002', 
      mobile: '+15142222222', 
      email: 'guest2@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'Mike Johnson' 
    },
    { 
      id: 'resident_20260811_ads', // Ali Rezaei
      code: 'UKA935', 
      floor: '2', 
      plate: 'ABC1234', 
      guest: 'GUEST-003', 
      mobile: '+15143333333', 
      email: 'guest3@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'Ali Rezaei' 
    },
    { 
      id: '80a418bb-e844-4e07-a367-182af76ca778', // John Doe
      code: 'JDO301', 
      floor: '3', 
      plate: 'XYZ-789', 
      guest: 'GUEST-004', 
      mobile: '+15144444444', 
      email: 'guest4@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'John Doe' 
    },
    { 
      id: 'baf47c69-7f63-4336-b092-1f46c5cb462b', // John Parker
      code: 'RES001', 
      floor: '5', 
      plate: 'ABC-1234', 
      guest: 'GUEST-005', 
      mobile: '+15145555555', 
      email: 'guest5@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'John Parker' 
    },
    { 
      id: 'e1eedf9b-6e88-4cf5-8f82-73bd01d5b1c1', // Sarah Smith
      code: 'SSM705', 
      floor: '7', 
      plate: 'LMN-456', 
      guest: 'GUEST-006', 
      mobile: '+15146666666', 
      email: 'guest6@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'Sarah Smith' 
    },
    { 
      id: 'resident_1785955431464_qzdeem', // Test Resident
      code: 'QRQ804', 
      floor: '5', 
      plate: 'ABC123', 
      guest: 'GUEST-007', 
      mobile: '+15147777777', 
      email: 'guest7@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'Test Resident' 
    },
    { 
      id: 'resident_1789968329771_a7eecc', // John Smith (different from Robert)
      code: 'XTX8GA', 
      floor: '7', 
      plate: 'GHI-789', 
      guest: 'GUEST-008', 
      mobile: '+15148888888', 
      email: 'guest8@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'John Smith' 
    },
    { 
      id: 'resident_1789968331395_9c9d97', // David Johnson
      code: '1IYIYZ', 
      floor: '12', 
      plate: 'JKL-223', 
      guest: 'GUEST-009', 
      mobile: '+15149999999', 
      email: 'guest9@test.com', 
      start: now.toISOString(),
      end: new Date(now.getTime() + 2*3600000).toISOString(),
      name: 'David Johnson' 
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const res of reservations) {
    try {
      const result = await createReservation(res.id, res.code, res.floor, res.plate, res.guest, res.mobile, res.email, res.start, res.end);
      
      if (result.data?.createReservation) {
        successCount++;
        console.log(`✅ ${res.name} (Floor ${res.floor})`);
        console.log(`   Guest: ${res.guest}`);
        console.log(`   ID: ${result.data.createReservation.id}`);
      } else {
        failCount++;
        console.log(`❌ ${res.name}: Failed`);
        if (result.errors) {
          console.log(`   Errors: ${JSON.stringify(result.errors)}`);
        }
      }
    } catch (error) {
      failCount++;
      console.log(`❌ ${res.name}: Error - ${error.message}`);
    }
    
    // کمی تاخیر بین درخواست‌ها
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${successCount}/9`);
  console.log(`❌ Failed: ${failCount}/9`);
  console.log('='.repeat(50));
}

main().catch(console.error);
