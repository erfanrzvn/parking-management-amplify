// Create multiple test residents
const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

const residents = [
  {
    email: 'john.doe@example.com',
    building: 'Building A',
    floor: '3',
    unitNumber: '301',
    plate: 'XYZ-789',
    residentCode: 'JDO301',
    userId: 'user-john-doe'
  },
  {
    email: 'sarah.smith@example.com',
    building: 'Building B',
    floor: '7',
    unitNumber: '705',
    plate: 'LMN-456',
    residentCode: 'SSM705',
    userId: 'user-sarah-smith'
  },
  {
    email: 'mike.johnson@example.com',
    building: 'Building A',
    floor: '12',
    unitNumber: '1203',
    plate: 'QRS-123',
    residentCode: 'MJO123',
    userId: 'user-mike-johnson'
  }
];

async function createResident(input) {
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
      }
    }
  `;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({ query: mutation, variables: { input } })
  });
  
  const result = await response.json();
  return result;
}

async function createAllResidents() {
  console.log('🧪 Creating test residents...\n');
  
  for (const resident of residents) {
    try {
      const result = await createResident(resident);
      
      if (result.errors) {
        console.log(`❌ Failed: ${resident.email}`);
        console.log(`   Error: ${result.errors[0].message}`);
      } else {
        console.log(`✅ Created: ${resident.email}`);
        console.log(`   ${resident.building} - Unit ${resident.unitNumber}, Code: ${resident.residentCode}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${resident.email} - ${error.message}`);
    }
  }
  
  console.log('\n✅ Done!');
}

createAllResidents();
