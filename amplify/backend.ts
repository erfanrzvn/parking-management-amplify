import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({
  auth,
  data,
});

// Set region to ca-central-1
backend.data.resources.cfnResources.cfnGraphqlApi.addPropertyOverride(
  'Region',
  'ca-central-1'
);
