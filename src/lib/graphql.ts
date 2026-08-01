import { generateClient } from 'aws-amplify/api';

const client = generateClient();

export async function listParkingConfigs() {
  const query = `
    query ListParkingConfigs {
      listParkingConfigs {
        items {
          id
          totalSpots
          updatedAt
          updatedBy
        }
      }
    }
  `;
  
  const result = await client.graphql({ query });
  return result.data.listParkingConfigs.items;
}

export async function createParkingConfig(input: { id: string; totalSpots: number; updatedAt: string; updatedBy: string }) {
  const mutation = `
    mutation CreateParkingConfig($input: CreateParkingConfigInput!) {
      createParkingConfig(input: $input) {
        id
        totalSpots
        updatedAt
        updatedBy
      }
    }
  `;
  
  const result = await client.graphql({
    query: mutation,
    variables: { input }
  });
  return result.data.createParkingConfig;
}

export async function listResidents() {
  const query = `
    query ListResidents {
      listResidents {
        items {
          id
          email
          floor
          plate
          residentCode
          userId
          createdAt
        }
      }
    }
  `;
  
  const result = await client.graphql({ query });
  return result.data.listResidents.items;
}

export async function createResident(input: any) {
  const mutation = `
    mutation CreateResident($input: CreateResidentInput!) {
      createResident(input: $input) {
        id
        email
        floor
        plate
        residentCode
        userId
        createdAt
      }
    }
  `;
  
  const result = await client.graphql({
    query: mutation,
    variables: { input }
  });
  return result.data.createResident;
}

export async function createReservation(input: any) {
  const mutation = `
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
        createdAt
      }
    }
  `;
  
  const result = await client.graphql({
    query: mutation,
    variables: { input }
  });
  return result.data.createReservation;
}

export async function listReservations() {
  const query = `
    query ListReservations {
      listReservations {
        items {
          id
          residentId
          residentCode
          endTime
          startTime
        }
      }
    }
  `;
  
  const result = await client.graphql({ query });
  return result.data.listReservations.items;
}
