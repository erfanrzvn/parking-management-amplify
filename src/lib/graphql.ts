import { generateClient } from 'aws-amplify/api';

const client = generateClient();

export async function listParkingConfigs() {
  const query = `
    query ListParkingConfigs {
      listParkingConfigs {
        id
        totalSpots
        updatedAt
        updatedBy
        createdAt
      }
    }
  `;
  
  const result: any = await client.graphql({ query });
  return result.data.listParkingConfigs;
}

export async function createParkingConfig(input: { id?: string; totalSpots: number; updatedAt: string; updatedBy: string }) {
  const mutation = `
    mutation CreateParkingConfig($input: CreateParkingConfigInput!) {
      createParkingConfig(input: $input) {
        id
        totalSpots
        updatedAt
        updatedBy
        createdAt
      }
    }
  `;
  
  const result: any = await client.graphql({
    query: mutation,
    variables: { input }
  });
  return result.data.createParkingConfig;
}

export async function listResidents() {
  const query = `
    query ListResidents {
      listResidents {
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
  
  const result: any = await client.graphql({ query });
  return result.data.listResidents;
}

export async function getResidentByUserId(userId: string) {
  const query = `
    query GetResidentByUserId($userId: String!) {
      getResidentByUserId(userId: $userId) {
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
  
  const result: any = await client.graphql({
    query,
    variables: { userId }
  });
  return result.data.getResidentByUserId;
}

export async function getResident(id: string) {
  const query = `
    query GetResident($id: ID!) {
      getResident(id: $id) {
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
  
  const result: any = await client.graphql({
    query,
    variables: { id }
  });
  return result.data.getResident;
}

export async function createResident(input: any) {
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
  
  const result: any = await client.graphql({
    query: mutation,
    variables: { input }
  });
  return result.data.createResident;
}

export async function updateResident(input: any) {
  const mutation = `
    mutation UpdateResident($input: UpdateResidentInput!) {
      updateResident(input: $input) {
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
  
  const result: any = await client.graphql({
    query: mutation,
    variables: { input }
  });
  return result.data.updateResident;
}

export async function deleteResident(id: string) {
  const mutation = `
    mutation DeleteResident($id: ID!) {
      deleteResident(id: $id) {
        id
      }
    }
  `;
  
  const result: any = await client.graphql({
    query: mutation,
    variables: { id }
  });
  return result.data.deleteResident;
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
  
  const result: any = await client.graphql({
    query: mutation,
    variables: { input }
  });
  return result.data.createReservation;
}

export async function listReservations() {
  const query = `
    query ListReservations {
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
  
  const result: any = await client.graphql({ query });
  return result.data.listReservations;
}
