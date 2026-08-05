import { generateClient } from 'aws-amplify/api';

const client = generateClient();

export async function listParkingConfigs() {
  const query = `
    query ListParkingConfigs {
      listParkingConfigs {
        id
        name
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

export async function createParkingConfig(input: { name: string; totalSpots: number; updatedBy?: string }) {
  const mutation = `
    mutation CreateParkingConfig($input: CreateParkingConfigInput!) {
      createParkingConfig(input: $input) {
        id
        name
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

export async function deleteParkingConfig(id: string) {
  const mutation = `
    mutation DeleteParkingConfig($id: ID!) {
      deleteParkingConfig(id: $id) {
        id
      }
    }
  `;
  
  const result: any = await client.graphql({
    query: mutation,
    variables: { id }
  });
  return result.data.deleteParkingConfig;
}

export async function listResidents(limit?: number, nextToken?: string) {
  const query = `
    query ListResidents($limit: Int, $nextToken: String) {
      listResidents(limit: $limit, nextToken: $nextToken) {
        items {
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
        nextToken
      }
    }
  `;
  
  const result: any = await client.graphql({ 
    query,
    variables: { limit, nextToken }
  });
  return result.data.listResidents.items;
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

export async function listReservations(limit?: number, nextToken?: string) {
  const query = `
    query ListReservations($limit: Int, $nextToken: String) {
      listReservations(limit: $limit, nextToken: $nextToken) {
        items {
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
        nextToken
      }
    }
  `;
  
  const result: any = await client.graphql({ 
    query,
    variables: { limit, nextToken }
  });
  return result.data.listReservations.items;
}

export async function cancelReservation(id: string) {
  const mutation = `
    mutation CancelReservation($id: ID!) {
      cancelReservation(id: $id) {
        id
        status
      }
    }
  `;
  
  const result: any = await client.graphql({
    query: mutation,
    variables: { id }
  });
  return result.data.cancelReservation;
}
