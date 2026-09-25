const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { isAdmin, requireAdmin } = require('./access');
const { normalize, scanAll } = require('./households');
const { withReservationLock } = require('./reservationStore');
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = kind => process.env[`${kind}_TABLE`] || ({ RESIDENT: 'Resident', RESERVATION: 'Reservation', PARKING_CONFIG: 'ParkingConfig' })[kind];
const all = kind => scanAll(client, { TableName: table(kind), ConsistentRead: true });
const active = (r, now = Date.now()) => !r.deletedAt && String(r.status).toUpperCase() !== 'CANCELLED' && Date.parse(r.endTime) > now;
const owner = (e, r) => !!e.identity?.sub && [r.userId, r.cognitoUsername].filter(Boolean).some(id => id === e.identity.sub || id === e.identity.username);
const codeOf = r => /^[A-Z0-9]{6}$/.test(normalize(r.householdId)) ? normalize(r.householdId) : normalize(r.residentCode);
const outputResident = r => r ? { ...r, householdId: codeOf(r), residentCode: codeOf(r) } : null;
async function get(kind, id) { return (await client.send(new GetCommand({ TableName: table(kind), Key: { id }, ConsistentRead: true }))).Item; }
function authenticated(event) { if (!event.identity?.sub) throw new Error('Unauthorized'); }
async function ownResident(event, id) {
  const resident = await get('RESIDENT', id);
  if (!resident || resident.deletedAt) throw new Error('Resident not found');
  if (!isAdmin(event) && !owner(event, resident)) throw new Error('Unauthorized');
  return resident;
}
async function householdReservations(event, reservations) {
  authenticated(event);
  if (isAdmin(event)) return reservations;
  const profiles = (await all('RESIDENT')).filter(r => !r.deletedAt && owner(event, r));
  return reservations.filter(reservation => profiles.some(r => r.id === reservation.residentId || codeOf(r) === (reservation.householdId || reservation.residentCode)));
}
async function page(kind, args) {
  const limit = args.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid page limit');
  let ExclusiveStartKey;
  if (args.nextToken) {
    try { ExclusiveStartKey = JSON.parse(Buffer.from(args.nextToken, 'base64url').toString()); }
    catch { throw new Error('Invalid pagination token'); }
    if (typeof ExclusiveStartKey?.id !== 'string') throw new Error('Invalid pagination token');
  }
  const result = await client.send(new ScanCommand({ TableName: table(kind), Limit: limit, ExclusiveStartKey, ConsistentRead: true }));
  return { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null };
}
exports.handler = async event => {
  const field = event.info?.fieldName;
  const args = event.arguments || {};
  if (field === 'createResidentWithCognito' || field === 'createResident') return require('./createResidentWithCognito').handler(event);
  if (field === 'updateResident') return require('./updateResident').handler(event);
  if (field === 'deleteResident') return require('./deleteResident').handler(event);
  if (field === 'importResidentsCSV') return require('./importResidentsCSV').handler(event);
  if (field === 'exportResidentsCSV') {
    const csv = await require('./exportResidentsCSV').handler(event);
    return event.info?.parentTypeName === 'Mutation' ? { success: true, csvData: csv, count: (await all('RESIDENT')).filter(r => !r.deletedAt).length, message: 'Export completed' } : csv;
  }
  if (field === 'verifyResidentCredentials') return require('./verifyResidentCredentials').handler(event);
  if (field === 'getResident') return outputResident(await ownResident(event, args.id));
  if (field === 'getResidentByUserId') {
    authenticated(event);
    if (!isAdmin(event) && args.userId !== event.identity.sub && args.userId !== event.identity.username) throw new Error('Unauthorized');
    return outputResident((await all('RESIDENT')).find(r => !r.deletedAt && (isAdmin(event) ? r.userId === args.userId : owner(event, r))));
  }
  if (field === 'listResidents') {
    requireAdmin(event);
    const result = await page('RESIDENT', args);
    return { ...result, items: result.items.filter(r => !r.deletedAt).map(outputResident) };
  }
  if (field === 'listParkingConfigs') return all('PARKING_CONFIG');
  if (field === 'getParkingConfig') return (await get('PARKING_CONFIG', args.id)) || null;
  if (field === 'checkAvailability') {
    const totalSpots = (await all('PARKING_CONFIG')).reduce((sum, p) => sum + p.totalSpots, 0);
    const reservations = (await all('RESERVATION')).filter(r => active(r));
    const availableSpots = Math.max(0, totalSpots - reservations.length);
    return { totalSpots, availableSpots, available: availableSpots > 0,
      nextAvailableTime: reservations.map(r => r.endTime).sort()[0] || null,
      message: availableSpots ? 'Parking available' : 'No parking spots available' };
  }
  if (field === 'listReservations') {
    authenticated(event);
    const result = await page('RESERVATION', args);
    return { ...result, items: await householdReservations(event, result.items) };
  }
  if (field === 'getReservation') {
    authenticated(event);
    const reservation = await get('RESERVATION', args.id);
    if (!reservation) return null;
    if (!(await householdReservations(event, [reservation])).length) throw new Error('Unauthorized');
    return reservation;
  }
  if (['createParkingConfig', 'updateParkingConfig', 'deleteParkingConfig'].includes(field)) {
    requireAdmin(event);
    return withReservationLock(client, async commit => {
      const input = args.input || {};
      const current = field === 'createParkingConfig' ? null : await get('PARKING_CONFIG', args.id || input.id);
      if (field !== 'createParkingConfig' && !current) throw new Error('Parking configuration not found');
      const now = new Date().toISOString();
      const item = { ...current, ...input, id: current?.id || randomUUID(), createdAt: current?.createdAt || now, updatedAt: now, updatedBy: event.identity.sub };
      if (field !== 'deleteParkingConfig' && (!Number.isInteger(item.totalSpots) || item.totalSpots < 0)) throw new Error('Capacity must be a nonnegative integer');
      const configs = await all('PARKING_CONFIG');
      const capacity = configs.filter(p => p.id !== item.id).reduce((s, p) => s + p.totalSpots, 0) + (field === 'deleteParkingConfig' ? 0 : item.totalSpots);
      if ((await all('RESERVATION')).filter(r => active(r)).length > capacity) throw new Error('Capacity cannot be reduced below active bookings');
      await commit([field === 'deleteParkingConfig' ? { Delete: { TableName: table('PARKING_CONFIG'), Key: { id: item.id } } } : { Put: { TableName: table('PARKING_CONFIG'), Item: item } }]);
      return item;
    });
  }
  if (['createReservation', 'updateReservation', 'cancelReservation', 'deleteReservation'].includes(field)) {
    if (field !== 'createReservation') authenticated(event);
    let verifiedResidentId;
    if (field === 'createReservation') {
      const verification = await require('./verifyResidentCredentials').handler({ ...event, arguments: { residentCode: args.input?.residentCode, unitNumber: args.input?.unitNumber } });
      if (!verification.isValid) throw new Error('Invalid resident code or unit number');
      verifiedResidentId = verification.residentId;
      if (args.input.residentId && args.input.residentId !== verifiedResidentId) throw new Error('Invalid resident code or unit number');
    }
    return withReservationLock(client, async commit => {
      const input = args.input || {}, now = new Date(), stamp = now.toISOString();
      let item;
      if (field === 'createReservation') {
        const resident = await get('RESIDENT', verifiedResidentId);
        if (!resident || resident.deletedAt || !resident.building || !resident.unitNumber || normalize(input.residentCode) !== codeOf(resident) || normalize(input.unitNumber) !== normalize(resident.unitNumber)) throw new Error('Invalid resident code or unit number');
        const end = Date.parse(input.endTime), duration = end - now.getTime();
        if (!Number.isFinite(end) || duration <= 0 || duration > 86400000) throw new Error('Duration must be between 0 and 24 hours');
        const guestPlate = normalize(input.guestPlate), guestMobile = String(input.guestMobile || '').replace(/[\s-]/g, ''), guestEmail = String(input.guestEmail || '').trim().toLowerCase();
        if (!/^[A-Z0-9-]{3,15}$/.test(guestPlate)) throw new Error('Invalid license plate');
        if (!/^\+[1-9]\d{7,14}$/.test(guestMobile)) throw new Error('Invalid phone number');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) throw new Error('Invalid email');
        const reservations = (await all('RESERVATION')).filter(r => active(r));
        const capacity = (await all('PARKING_CONFIG')).reduce((sum, p) => sum + p.totalSpots, 0);
        if (reservations.length >= capacity) throw new Error('No parking spots available');
        const members = (await all('RESIDENT')).filter(r => normalize(r.building) === normalize(resident.building) && normalize(r.unitNumber) === normalize(resident.unitNumber)).map(r => r.id);
        if (reservations.some(r => normalize(r.guestPlate) === guestPlate)) throw new Error('License plate already has an active reservation');
        if (reservations.some(r => members.includes(r.residentId) || (r.householdId || r.residentCode) === codeOf(resident))) throw new Error('Household already has an active reservation');
        item = { id: randomUUID(), residentId: resident.id, householdId: codeOf(resident), residentCode: codeOf(resident), residentFloor: resident.floor, residentPlate: resident.plate,
          guestPlate, guestMobile, guestEmail, startTime: stamp, endTime: new Date(end).toISOString(), status: 'ACTIVE', createdAt: stamp, updatedAt: stamp };
      } else {
        item = await get('RESERVATION', args.id || input.id);
        if (!item) throw new Error('Reservation not found');
        if (!isAdmin(event)) {
          if (field !== 'cancelReservation') throw new Error('Unauthorized');
          if (!(await householdReservations(event, [item])).length) throw new Error('Unauthorized');
        }
        if (field === 'updateReservation') {
          const end = Date.parse(input.endTime);
          if (!active(item) || !Number.isFinite(end) || end <= Date.parse(item.endTime) || end - Date.parse(item.startTime) > 86400000) throw new Error('Extension must increase an active booking within its 24-hour limit');
          item.endTime = new Date(end).toISOString();
        } else { item.status = 'CANCELLED'; item.deletedAt = stamp; }
        item.updatedAt = stamp;
      }
      await commit([{ Put: { TableName: table('RESERVATION'), Item: item } }]);
      return item;
    });
  }
  throw new Error('Unsupported API operation');
};
