const { DynamoDBClient, ScanCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { logAction } = require('./auditLogger');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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

// Rate limit: 10 reservations per IP per hour
const MAX_RESERVATIONS_PER_HOUR = 10;
const WINDOW_SECONDS = 3600; // 1 hour

// Extract IP from AppSync context
const getClientIP = (ctx) => {
  return ctx?.request?.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || ctx?.request?.headers['x-real-ip'] 
    || ctx?.identity?.sourceIp 
    || 'unknown';
};

const checkRateLimit = async (key) => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + WINDOW_SECONDS;
  
  try {
    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.RATE_LIMIT_TABLE,
      Key: { key }
    }));
    
    if (getResult.Item) {
      const attempts = getResult.Item.attempts || 0;
      const expiresAt = getResult.Item.ttl || 0;
      
      if (expiresAt < now) {
        // Reset counter
        await docClient.send(new PutCommand({
          TableName: process.env.RATE_LIMIT_TABLE,
          Item: {
            key,
            attempts: 1,
            ttl,
            lastAttempt: now
          }
        }));
        return { allowed: true, remaining: MAX_RESERVATIONS_PER_HOUR - 1 };
      }
      
      if (attempts >= MAX_RESERVATIONS_PER_HOUR) {
        const resetIn = expiresAt - now;
        return { 
          allowed: false, 
          remaining: 0,
          resetIn 
        };
      }
      
      await docClient.send(new UpdateCommand({
        TableName: process.env.RATE_LIMIT_TABLE,
        Key: { key },
        UpdateExpression: 'SET attempts = attempts + :inc, lastAttempt = :now',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':now': now
        }
      }));
      
      return { allowed: true, remaining: MAX_RESERVATIONS_PER_HOUR - attempts - 1 };
    } else {
      // First attempt
      await docClient.send(new PutCommand({
        TableName: process.env.RATE_LIMIT_TABLE,
        Item: {
          key,
          attempts: 1,
          ttl,
          lastAttempt: now
        }
      }));
      return { allowed: true, remaining: MAX_RESERVATIONS_PER_HOUR - 1 };
    }
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: MAX_RESERVATIONS_PER_HOUR };
  }
};

exports.handler = async (event) => {
  console.log('CreateReservation input:', JSON.stringify(event));
  
  try {
    const input = event.arguments.input;
    const clientIP = getClientIP(event);
    
    // Rate limiting
    const rateLimitKey = `reservation:${clientIP}`;
    const rateLimit = await checkRateLimit(rateLimitKey);
    
    if (!rateLimit.allowed) {
      const minutes = Math.ceil(rateLimit.resetIn / 60);
      throw new Error(`Too many reservations. Please try again in ${minutes} minute(s).`);
    }
    
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
    const parkingScan = await dynamoClient.send(new ScanCommand({
      TableName: process.env.PARKING_CONFIG_TABLE,
      Limit: 1
    }));
    
    const totalSpots = parkingScan.Items?.[0] ? unmarshall(parkingScan.Items[0]).totalSpots : 10;
    
    // Get active reservations
    const reservationScan = await dynamoClient.send(new ScanCommand({
      TableName: process.env.RESERVATION_TABLE,
      FilterExpression: 'endTime > :now AND (attribute_not_exists(deletedAt) OR deletedAt = :null)',
      ExpressionAttributeValues: marshall({
        ':now': nowISO,
        ':null': null
      })
    }));
    
    const activeReservations = reservationScan.Items?.length || 0;
    
    if (activeReservations >= totalSpots) {
      throw new Error('No parking spots available');
    }
    
    // Validation 4: Check duplicate active reservation for same plate
    const plateScan = await dynamoClient.send(new ScanCommand({
      TableName: process.env.RESERVATION_TABLE,
      FilterExpression: 'guestPlate = :plate AND endTime > :now AND (attribute_not_exists(deletedAt) OR deletedAt = :null)',
      ExpressionAttributeValues: marshall({
        ':plate': guestPlate,
        ':now': nowISO,
        ':null': null
      })
    }));
    
    if (plateScan.Items && plateScan.Items.length > 0) {
      throw new Error('This license plate already has an active reservation');
    }
    
    // Validation 5: Verify resident exists
    const residentScan = await dynamoClient.send(new ScanCommand({
      TableName: process.env.RESIDENT_TABLE,
      FilterExpression: 'id = :id AND (attribute_not_exists(deletedAt) OR deletedAt = :null)',
      ExpressionAttributeValues: marshall({
        ':id': input.residentId,
        ':null': null
      })
    }));
    
    if (!residentScan.Items || residentScan.Items.length === 0) {
      throw new Error('Invalid resident ID');
    }
    
    // Validation 6: Check for time overlap
    const residentReservations = await dynamoClient.send(new ScanCommand({
      TableName: process.env.RESERVATION_TABLE,
      FilterExpression: 'residentId = :residentId AND endTime > :now AND (attribute_not_exists(deletedAt) OR deletedAt = :null)',
      ExpressionAttributeValues: marshall({
        ':residentId': input.residentId,
        ':now': nowISO,
        ':null': null
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
    
    await dynamoClient.send(new PutItemCommand({
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
        createdAt: nowISO,
        updatedAt: nowISO
      })
    }));
    
    // Email notification (commented out - needs SES configuration)
    /*
    try {
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      const sesClient = new SESClient({});
      
      const emailParams = {
        Source: 'noreply@parkingmanagement.com', // Replace with verified SES email
        Destination: {
          ToAddresses: [guestEmail]
        },
        Message: {
          Subject: {
            Data: 'Parking Reservation Confirmed',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: `
                <html>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2 style="color: #2563eb;">Parking Reservation Confirmed</h2>
                    <p>Your parking spot has been reserved successfully!</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Reservation Details:</h3>
                      <p><strong>Guest Plate:</strong> ${guestPlate}</p>
                      <p><strong>Start Time:</strong> ${new Date(startTime).toLocaleString()}</p>
                      <p><strong>End Time:</strong> ${new Date(input.endTime).toLocaleString()}</p>
                      <p><strong>Resident Code:</strong> ${input.residentCode.toUpperCase()}</p>
                      <p><strong>Floor:</strong> ${input.residentFloor || 'N/A'}</p>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px;">
                      Please arrive on time and display your parking permit clearly.
                      If you need to extend your reservation, please contact the resident.
                    </p>
                    
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </body>
                </html>
              `,
              Charset: 'UTF-8'
            },
            Text: {
              Data: `
Parking Reservation Confirmed

Your parking spot has been reserved successfully!

Reservation Details:
- Guest Plate: ${guestPlate}
- Start Time: ${new Date(startTime).toLocaleString()}
- End Time: ${new Date(input.endTime).toLocaleString()}
- Resident Code: ${input.residentCode.toUpperCase()}
- Floor: ${input.residentFloor || 'N/A'}

Please arrive on time and display your parking permit clearly.
              `,
              Charset: 'UTF-8'
            }
          }
        }
      };
      
      await sesClient.send(new SendEmailCommand(emailParams));
      console.log(`Email sent to ${guestEmail}`);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the reservation if email fails
    }
    */
    
    // Audit log
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
      createdAt: nowISO,
      updatedAt: nowISO
    };
  } catch (error) {
    console.error('Error:', error);
    // Sanitize error message
    const message = error.message || 'Failed to create reservation';
    throw new Error(message);
  }
};
