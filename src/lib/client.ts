import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

let clientInstance: ReturnType<typeof generateClient<Schema>> | null = null;

export function getClient() {
  if (!clientInstance) {
    console.log('Initializing Amplify client...');
    clientInstance = generateClient<Schema>();
    console.log('Amplify client initialized');
  }
  return clientInstance;
}
