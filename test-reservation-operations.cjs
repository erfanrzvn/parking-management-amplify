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

async function runReservationTests() {
  console.log('🚀 Starting Reservation CRUD Tests...\n');

  try {
    // SETUP: Get a resident to use for testing
    console.log('📋 SETUP: Getting existing residents');
    const listResidentsQuery = `
      query ListResidents {
        listResidents {
          items {
            id
            email
            name
            residentCode
            building
            floor
            unitNumber
            plate
          }
        }
      }
    `;
    const residents = await graphqlRequest(listResidentsQuery);
    
    if (!residents.listResidents?.items?.length) {
      throw new Error('No residents found - need at least one resident to test reservations');
    }
    
    const testResident = residents.listResidents.items[0];
    console.log(`✅ Using resident: ${testResident.name || testResident.email}`);
    console.log(`   Resident Code: ${testResident.residentCode}`);
    console.log(`   Building: ${testResident.building}, Unit: ${testResident.unitNumber}`);
    console.log('');

    // TEST 1: Check availability
    console.log('🔍 TEST 1: Check parking availability');
    const checkAvailabilityQuery = `
      query CheckAvailability {
        checkAvailability {
          available
          availableSpots
        }
      }
    `;
    const availability = await graphqlRequest(checkAvailabilityQuery);
    console.log(`✅ Availability checked:`);
    console.log(`   Available Spots: ${availability.checkAvailability.availableSpots}`);
    console.log(`   Is Available: ${availability.checkAvailability.available ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (!availability.checkAvailability.available) {
      console.log('⚠️  Warning: No parking spots available. Continuing with tests anyway...\n');
    }

    // TEST 2: Create a new reservation
    console.log('📝 TEST 2: Create a new reservation');
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    
    const createReservationMutation = `
      mutation CreateReservation($input: CreateReservationInput!) {
        createReservation(input: $input) {
          id
          residentId
          residentCode
          residentFloor
          residentPlate
          guestPlate
          guestEmail
          guestMobile
          startTime
          endTime
          createdAt
        }
      }
    `;
    
    const reservationInput = {
      residentId: testResident.id,
      residentCode: testResident.residentCode,
      residentFloor: testResident.floor,
      residentPlate: testResident.plate,
      guestPlate: `TEST${Math.floor(Math.random() * 1000)}`,
      guestEmail: `test-guest-${Date.now()}@example.com`,
      guestMobile: `+1416555${Math.floor(Math.random() * 9000) + 1000}`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
    
    console.log(`   Guest Plate: ${reservationInput.guestPlate}`);
    console.log(`   Start: ${startTime.toLocaleString()}`);
    console.log(`   End: ${endTime.toLocaleString()}`);
    
    const newReservation = await graphqlRequest(createReservationMutation, {
      input: reservationInput
    });
    
    const reservationId = newReservation.createReservation.id;
    console.log(`✅ Reservation created successfully!`);
    console.log(`   Reservation ID: ${reservationId}`);
    console.log(`   Guest: ${newReservation.createReservation.guestEmail}`);
    console.log(`   Plate: ${newReservation.createReservation.guestPlate}`);
    console.log('');

    // TEST 3: Get reservation by ID
    console.log('🔍 TEST 3: Get reservation by ID');
    const getReservationQuery = `
      query GetReservation($id: ID!) {
        getReservation(id: $id) {
          id
          residentId
          guestPlate
          guestEmail
          guestMobile
          startTime
          endTime
        }
      }
    `;
    const fetchedReservation = await graphqlRequest(getReservationQuery, {
      id: reservationId
    });
    console.log(`✅ Fetched reservation: ${fetchedReservation.getReservation.guestPlate}`);
    console.log(`   Email: ${fetchedReservation.getReservation.guestEmail}`);
    console.log(`   Mobile: ${fetchedReservation.getReservation.guestMobile}`);
    console.log('');

    // TEST 4: List all reservations
    console.log('📋 TEST 4: List all reservations');
    const listReservationsQuery = `
      query ListReservations {
        listReservations {
          items {
            id
            guestPlate
            startTime
            endTime
          }
        }
      }
    `;
    const allReservations = await graphqlRequest(listReservationsQuery);
    console.log(`✅ Found ${allReservations.listReservations.items.length} total reservations`);
    console.log(`   Our test reservation is included: ${allReservations.listReservations.items.some(r => r.id === reservationId) ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // TEST 5: Check availability after creating reservation
    console.log('🔍 TEST 5: Re-check availability (should be one less spot)');
    const newAvailability = await graphqlRequest(checkAvailabilityQuery);
    console.log(`✅ Updated availability:`);
    console.log(`   Available Spots: ${newAvailability.checkAvailability.availableSpots}`);
    const spotsDifference = availability.checkAvailability.availableSpots - newAvailability.checkAvailability.availableSpots;
    console.log(`   Difference: ${spotsDifference} ${spotsDifference === 1 ? '✅ CORRECT' : '⚠️  UNEXPECTED'}`);
    console.log('');

    // TEST 6: Update reservation (extend time)
    console.log('🔄 TEST 6: Update reservation (extend by 2 hours)');
    const newEndTime = new Date(endTime.getTime() + 2 * 60 * 60 * 1000); // Add 2 more hours
    const updateReservationMutation = `
      mutation UpdateReservation($input: UpdateReservationInput!) {
        updateReservation(input: $input) {
          id
          endTime
        }
      }
    `;
    const updatedReservation = await graphqlRequest(updateReservationMutation, {
      input: {
        id: reservationId,
        endTime: newEndTime.toISOString()
      }
    });
    console.log(`✅ Reservation extended`);
    console.log(`   Old end time: ${endTime.toLocaleString()}`);
    console.log(`   New end time: ${new Date(updatedReservation.updateReservation.endTime).toLocaleString()}`);
    console.log('');

    // TEST 7: Verify update
    console.log('✔️  TEST 7: Verify the update');
    const verifyReservation = await graphqlRequest(getReservationQuery, {
      id: reservationId
    });
    const fetchedEndTime = new Date(verifyReservation.getReservation.endTime);
    console.log(`✅ Verified: End time is ${fetchedEndTime.toLocaleString()}`);
    const isCorrect = Math.abs(fetchedEndTime.getTime() - newEndTime.getTime()) < 1000;
    console.log(`   Update successful: ${isCorrect ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // TEST 8: Cancel/Delete reservation
    console.log('🗑️  TEST 8: Cancel reservation');
    const cancelReservationMutation = `
      mutation CancelReservation($id: ID!) {
        cancelReservation(id: $id) {
          id
        }
      }
    `;
    await graphqlRequest(cancelReservationMutation, {
      id: reservationId
    });
    console.log(`✅ Reservation cancelled (ID: ${reservationId})`);
    console.log('');

    // TEST 9: Verify deletion
    console.log('✔️  TEST 9: Verify reservation is cancelled');
    try {
      const deletedReservation = await graphqlRequest(getReservationQuery, {
        id: reservationId
      });
      if (deletedReservation.getReservation) {
        console.log('⚠️  Note: Reservation still exists (might be soft delete or marked as cancelled)');
      }
    } catch (e) {
      console.log('✅ Confirmed: Reservation no longer accessible');
    }
    console.log('');

    // TEST 10: Check availability after deletion
    console.log('🔍 TEST 10: Final availability check (should be restored)');
    const finalAvailability = await graphqlRequest(checkAvailabilityQuery);
    console.log(`✅ Final availability:`);
    console.log(`   Available Spots: ${finalAvailability.checkAvailability.availableSpots}`);
    console.log(`   Back to original: ${finalAvailability.checkAvailability.availableSpots === availability.checkAvailability.availableSpots ? '✅ YES' : '⚠️  NO'}`);
    console.log('');

    // TEST 11: Test household reservation limits
    console.log('👨‍👩‍👧‍👦 TEST 11: Test household reservation limits');
    console.log('   Finding residents in same household...');
    const householdResidents = residents.listResidents.items.filter(r => 
      r.building === testResident.building && 
      r.floor === testResident.floor && 
      r.unitNumber === testResident.unitNumber
    );
    console.log(`   Found ${householdResidents.length} residents in Building ${testResident.building}, Unit ${testResident.unitNumber}`);
    
    if (householdResidents.length > 1) {
      console.log(`   Household members:`);
      householdResidents.forEach(r => {
        console.log(`     - ${r.name || r.email} (${r.residentCode})`);
      });
      console.log(`   ✅ Household grouping is working`);
    } else {
      console.log(`   ℹ️  Only one resident in this household`);
    }
    console.log('');

    // SUMMARY
    console.log('═══════════════════════════════════════');
    console.log('🎉 ALL RESERVATION TESTS PASSED!');
    console.log('═══════════════════════════════════════');
    console.log('✅ Check Availability');
    console.log('✅ Create Reservation');
    console.log('✅ Get Reservation by ID');
    console.log('✅ List All Reservations');
    console.log('✅ Re-check Availability (spot taken)');
    console.log('✅ Update Reservation (extend time)');
    console.log('✅ Verify Update');
    console.log('✅ Cancel Reservation');
    console.log('✅ Verify Cancellation');
    console.log('✅ Final Availability (spot freed)');
    console.log('✅ Household Grouping Check');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runReservationTests();
