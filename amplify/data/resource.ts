import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // Parking Configuration (Admin sets total spots)
  ParkingConfig: a
    .model({
      id: a.id().required(),
      name: a.string(),
      totalSpots: a.integer().required(),
      updatedAt: a.datetime(),
      updatedBy: a.string(),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.publicApiKey().to(['read']),
    ]),

  // Resident Model
  Resident: a
    .model({
      id: a.id().required(),
      email: a.email().required(),
      name: a.string(),
      phone: a.phone(),
      building: a.string(),
      floor: a.string().required(),
      unitNumber: a.string(),
      plate: a.string().required(),
      residentCode: a.string().required(),
      userId: a.string().required(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.group('ADMIN'),
      allow.publicApiKey().to(['read']),
    ]),

  // Guest Reservation Model
  Reservation: a
    .model({
      id: a.id().required(),
      residentId: a.string().required(),
      residentCode: a.string().required(),
      residentFloor: a.string(),
      residentPlate: a.string(),
      guestPlate: a.string().required(),
      guestMobile: a.phone().required(),
      guestEmail: a.email().required(),
      startTime: a.datetime().required(),
      endTime: a.datetime().required(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),
      allow.group('ADMIN'),
    ]),

  // Custom Queries - Temporarily disabled for deploy
  // checkAvailability: a
  //   .query()
  //   .returns(
  //     a.customType({
  //       available: a.boolean().required(),
  //       availableSpots: a.integer().required(),
  //       totalSpots: a.integer().required(),
  //       nextAvailableTime: a.datetime(),
  //       message: a.string().required(),
  //     })
  //   )
  //   .authorization((allow) => [allow.publicApiKey()])
  //   .handler(
  //     a.handler.custom({
  //       dataSource: 'ReservationTable',
  //       entry: './checkAvailability.js',
  //     })
  //   ),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
