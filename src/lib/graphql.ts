import { generateClient } from 'aws-amplify/api';

const client = generateClient({ authMode: 'userPool' });

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
  
  const result: any = await client.graphql({ query, authMode: 'apiKey' });
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
          name
          phone
          building
          floor
          unitNumber
          plate
          householdId
          userId
          createdAt
          updatedAt
          deletedAt
        }
        nextToken
      }
    }
  `;
  
  const items: any[] = [];
  let token = nextToken;
  do {
    const result: any = await client.graphql({ query, variables: { limit: limit || 100, nextToken: token } });
    const page = result.data.listResidents;
    items.push(...(page.items || []).filter(Boolean));
    token = page.nextToken;
  } while (token);
  return items.filter((r: any) => !r.deletedAt);
}

export async function getResidentByUserId(userId: string) {
  const query = `
    query GetResidentByUserId($userId: String!) {
      getResidentByUserId(userId: $userId) {
        id
        email
        name
        phone
        building
        floor
        unitNumber
        plate
        householdId
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
        name
        phone
        building
        floor
        unitNumber
        plate
        householdId
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
        name
        phone
        building
        floor
        unitNumber
        plate
        householdId
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
        name
        phone
        building
        floor
        unitNumber
        plate
        householdId
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
        householdId
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
    authMode: 'apiKey',
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
          householdId
          deletedAt
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
  
  const items: any[] = [];
  let token = nextToken;
  do {
    const result: any = await client.graphql({ query, variables: { limit: limit || 100, nextToken: token } });
    const page = result.data.listReservations;
    items.push(...(page.items || []).filter(Boolean));
    token = page.nextToken;
  } while (token);
  return items;
}

export async function cancelReservation(id: string) {
  const mutation = `
    mutation CancelReservation($id: ID!) {
      cancelReservation(id: $id) {
        id
        status
        deletedAt
      }
    }
  `;
  

  
  const result: any = await client.graphql({
    query: mutation,
    variables: { id }
  });
  

  return result.data.cancelReservation;
}
