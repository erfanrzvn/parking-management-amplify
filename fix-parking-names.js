// Fix old parkings without names
const API_URL = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql';
const API_KEY = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra';

const parkingsToFix = [
  { id: 'd8bf7cb5-9cd5-4e8e-b39d-7dee3d807eab', name: 'Main Parking' },
  { id: 'ff696dfb-7955-41fa-b486-e003ef12f251', name: 'Secondary Parking' }
];

async function updateParking(id, name) {
  const mutation = `
    mutation UpdateParkingConfig($input: UpdateParkingConfigInput!) {
      updateParkingConfig(input: $input) {
        id
        name
        totalSpots
      }
    }
  `;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: { id, name }
      }
    })
  });
  
  return await response.json();
}

async function fixParkings() {
  console.log('🔧 Fixing old parkings without names...\n');
  
  for (const parking of parkingsToFix) {
    console.log(`Updating ${parking.id}...`);
    const result = await updateParking(parking.id, parking.name);
    
    if (result.errors) {
      console.log(`❌ Failed: ${result.errors[0].message}`);
    } else {
      console.log(`✅ Updated to: ${result.data.updateParkingConfig.name}\n`);
    }
  }
  
  console.log('✅ Done!');
}

fixParkings().catch(console.error);
