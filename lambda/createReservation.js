const { DynamoDBClient, ScanCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { logAction } = require('./auditLogger');

const dynamodb = new DynamoDBClient({});

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => /^\+?[1-9]\d{1,14}$/.test(phone);
const validatePlate = (plate) => /^[A-Z0-9-]{3,15}$/.test(plate);

// Sanitize string to prevent XSS
const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>\"'&]/g, (char) => {
    const entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' };
    return entities[char] || char;
  });
};

exports.handler = async (event) => {
  console.log('CreateReservation input:', JSON.stringify(event));
  
  try {
    const input = event.arguments.input;
    const now = new Date();
    const nowISO = now.toISOString();
    
    // Always use current time as start time (ignore input.startTime)
    const startTime = now;
    const endTime = new Date(input.endTime);
    
    // Sanitize inputs
    const guestEmail = sanitize(input.guestEmail).toLowerCase();
    const guestMobile = sanitize(input.guestMobile);
    const guestPlate = sanitize(input.guestPlate).toUpperCase();
    
    // Validation 1: Duration check
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);
    
    if (durationHours <= 0) {
      throw new Error('Duration must be greater than 0');
    }
    
    if (durationHours > 24) {
      throw new Error('Maximum parking duration is 24 hours');
    }
    
    // Validation 2: Format validation
    if (!validateEmail(guestEmail)) {
      throw new Error('Invalid email format');
    }
    
    if (!validatePhone(guestMobile)) {
      throw new Error('Invalid phone format');
    }
    
    if (!validatePlate(guestPlate)) {
      throw new Error('Invalid license plate format');
    }
    
    // Validation 3: Check parking availability
    const parkingScan = await dynamodb.send(new ScanCommand({
      TableName: process.env.PARKING_CONFIG_TABLE,
      Limit: 1
    }));
    
    const totalSpots = parkingScan.Items?.[0] ? unmarshall(parkingScan.Items[0]).totalSpots : 10;
    
    // Get active reservations
    const reservationScan = await dynamodb.send(new ScanCommand({
      TableName: process.env.RESERVATION_TABLE,
      FilterExpression: 'endTime > :now AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: marshall({
        ':now': nowISO
      })
    }));
    
    const activeReservations = reservationScan.Items?.length || 0;
    
    if (activeReservations >= totalSpots) {
      throw new Error('No parking spots available');
    }
    
    // Validation 4: Check duplicate active reservation for same plate
    const plateScan = await dynamodb.send(new ScanCommand({
      TableName: process.env.RESERVATION_TABLE,
      FilterExpression: 'guestPlate = :plate AND endTime > :now AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: marshall({
        ':plate': guestPlate,
        ':now': nowISO
      })
    }));
    
    if (plateScan.Items && plateScan.Items.length > 0) {
      throw new Error('This license plate already has an active reservation');
    }
    
    // Validation 5: Verify resident exists
    const residentScan = await dynamodb.send(new ScanCommand({
      TableName: process.env.RESIDENT_TABLE,
      FilterExpression: 'id = :id AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: marshall({
        ':id': input.residentId
      })
    }));
    
    if (!residentScan.Items || residentScan.Items.length === 0) {
      throw new Error('Invalid resident ID');
    }
    
    // Validation 6: Check for time overlap
    const residentReservations = await dynamodb.send(new ScanCommand({
      TableName: process.env.RESERVATION_TABLE,
      FilterExpression: 'residentId = :residentId AND endTime > :now AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: marshall({
        ':residentId': input.residentId,
        ':now': nowISO
      })
    }));
    
    if (residentReservations.Items && residentReservations.Items.length > 0) {
      for (const item of residentReservations.Items) {
        const existingRes = unmarshall(item);
        const existingStart = new Date(existingRes.startTime);
        const existingEnd = new Date(existingRes.endTime);
        
        if (startTime < existingEnd && endTime > existingStart) {
          throw new Error('This resident already has a reservation during this time period');
        }
      }
    }
    
    // Create reservation
    const id = `res_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.RESERVATION_TABLE,
      Item: marshall({
        id,
        residentId: input.residentId,
        residentCode: input.residentCode.toUpperCase(),
        residentFloor: input.residentFloor || 'N/A',
        residentPlate: input.residentPlate || 'N/A',
        guestPlate,
        guestMobile,
        guestEmail,
        startTime: startTime.toISOString(),
        endTime: input.endTime,
        status: 'active',
        createdAt: nowISO,
        updatedAt: nowISO
      })
    }));
    
    // Audit log
    const clientIP = event?.request?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    await logAction(
      'CREATE_RESERVATION',
      input.residentId,
      {
        guestPlate,
        guestEmail,
        startTime: startTime.toISOString(),
        endTime: input.endTime,
        clientIP
      },
      'Reservation',
      id
    );
    
    return {
      id,
      residentId: input.residentId,
      residentCode: input.residentCode.toUpperCase(),
      residentFloor: input.residentFloor || 'N/A',
      residentPlate: input.residentPlate || 'N/A',
      guestPlate,
      guestMobile,
      guestEmail,
      startTime: startTime.toISOString(),
      endTime: input.endTime,
      status: 'active',
      createdAt: nowISO,
      updatedAt: nowISO
    };
  } catch (error) {
    console.error('Error:', error);
    throw new Error(error.message || 'Failed to create reservation');
  }
};
