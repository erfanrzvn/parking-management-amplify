// Quick API test script
const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

async function testAPI(query, variables = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ query, variables })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Testing Parking Management API...\n');
  
  // Test 1: List Residents
  console.log('1️⃣ Testing listResidents...');
  const residentsQuery = `
    query {
      listResidents {
        id
        email
        building
        floor
        unitNumber
        plate
        residentCode
      }
    }
  `;
  const residentsResult = await testAPI(residentsQuery);
  if (residentsResult?.data?.listResidents) {
    console.log('✅ listResidents OK');
    console.log(`   Found ${residentsResult.data.listResidents.length} residents`);
    if (residentsResult.data.listResidents.length > 0) {
      const resident = residentsResult.data.listResidents[0];
      console.log(`   Sample: ${resident.building || 'N/A'} - Unit ${resident.unitNumber || 'N/A'}, Floor ${resident.floor || 'N/A'}`);
    }
  } else {
    console.log('❌ listResidents FAILED');
    console.log(residentsResult);
  }
  
  // Test 2: List Reservations
  console.log('\n2️⃣ Testing listReservations...');
  const reservationsQuery = `
    query {
      listReservations {
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
        createdAt
      }
    }
  `;
  const reservationsResult = await testAPI(reservationsQuery);
  if (reservationsResult?.data?.listReservations) {
    console.log('✅ listReservations OK');
    console.log(`   Found ${reservationsResult.data.listReservations.length} reservations`);
    if (reservationsResult.data.listReservations.length > 0) {
      const res = reservationsResult.data.listReservations[0];
      console.log(`   Sample: Guest Plate: ${res.guestPlate}, Resident Code: ${res.residentCode}`);
      
      // Check if guestPlate exists
      const hasGuestPlate = res.guestPlate && res.guestPlate !== '';
      console.log(`   ${hasGuestPlate ? '✅' : '❌'} guestPlate field present`);
      
      // Check if guestEmail exists
      const hasGuestEmail = res.guestEmail && res.guestEmail !== '';
      console.log(`   ${hasGuestEmail ? '✅' : '❌'} guestEmail field present`);
      
      // Check if guestMobile exists
      const hasGuestMobile = res.guestMobile && res.guestMobile !== '';
      console.log(`   ${hasGuestMobile ? '✅' : '❌'} guestMobile field present`);
    }
  } else {
    console.log('❌ listReservations FAILED');
    console.log(reservationsResult);
  }
  
  // Test 3: List Parking Configs
  console.log('\n3️⃣ Testing listParkingConfigs...');
  const parkingsQuery = `
    query {
      listParkingConfigs {
        id
        totalSpots
        createdAt
      }
    }
  `;
  const parkingsResult = await testAPI(parkingsQuery);
  if (parkingsResult?.data?.listParkingConfigs) {
    console.log('✅ listParkingConfigs OK');
    console.log(`   Found ${parkingsResult.data.listParkingConfigs.length} parking locations`);
  } else {
    console.log('❌ listParkingConfigs FAILED');
    console.log(parkingsResult);
  }
  
  console.log('\n✅ All API tests completed!');
}

runTests().catch(console.error);
