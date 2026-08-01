export function request(ctx) {
  return {
    operation: 'Scan',
    filter: {
      endTime: { gt: { S: new Date().toISOString() } }
    }
  };
}

export function response(ctx) {
  const activeReservations = ctx.result.items;
  const totalSpots = 20; // Default, should be fetched from ParkingConfig
  const availableSpots = totalSpots - activeReservations.length;
  
  if (availableSpots > 0) {
    return {
      available: true,
      availableSpots,
      totalSpots,
      nextAvailableTime: null,
      message: `${availableSpots} جای پارک خالی است`
    };
  }
  
  // Find earliest ending reservation
  const sorted = activeReservations.sort((a, b) => 
    new Date(a.endTime) - new Date(b.endTime)
  );
  
  return {
    available: false,
    availableSpots: 0,
    totalSpots,
    nextAvailableTime: sorted[0]?.endTime || null,
    message: 'همه جاهای پارک پر است'
  };
}
