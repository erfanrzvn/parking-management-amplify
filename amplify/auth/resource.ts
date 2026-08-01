import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: {
      required: true,
      mutable: false,
    },
    'custom:userType': {
      dataType: 'String',
      mutable: true,
    },
    'custom:floor': {
      dataType: 'String',
      mutable: true,
    },
    'custom:plate': {
      dataType: 'String',
      mutable: true,
    },
    'custom:residentCode': {
      dataType: 'String',
      mutable: true,
    },
  },
  groups: ['ADMIN', 'RESIDENT'],
});
