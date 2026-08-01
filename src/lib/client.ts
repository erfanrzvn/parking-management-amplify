import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

let clientInstance: ReturnType<typeof generateClient<Schema>> | null = null;

export function getClient() {
  if (!clientInstance) {
    console.log('Creating new Amplify client instance...');
    clientInstance = generateClient<Schema>();
    console.log('Client created:', clientInstance);
  }
  return clientInstance;
}
