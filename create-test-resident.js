// Create test resident
const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

async function createTestResident() {
  const mutation = `
    mutation CreateResident($input: CreateResidentInput!) {
      createResident(input: $input) {
        id
        email
        building
        floor
        unitNumber
        plate
        residentCode
        userId
        createdAt
      }
    }
  `;

  const variables = {
    input: {
      email: 'resident@parking.com',
      building: 'Building A',
      floor: '5',
      unitNumber: '502',
      plate: 'ABC-1234',
      residentCode: 'RES001',
      userId: 'test-user-resident'
    }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ query: mutation, variables })
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ Error creating resident:', result.errors);
    } else {
      console.log('✅ Resident created successfully!');
      console.log(JSON.stringify(result.data.createResident, null, 2));
    }
  } catch (error) {
    console.error('❌ API Error:', error);
  }
}

createTestResident();
