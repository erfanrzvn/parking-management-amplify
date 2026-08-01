// Mock API Test - تست بدون نیاز به AWS
// Run: node test/mock-api-test.js

console.log('🧪 شروع تست Mock API...\n');

// Mock Data Storage
const mockDB = {
  parkingConfig: null,
  residents: [],
  reservations: []
};

// Helper Functions
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function generateResidentCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Mock API Functions
const API = {
  // Admin: Set Total Parking Spots
  setTotalSpots: (totalSpots, adminId = 'admin-123') => {
    console.log(`📊 Admin ${adminId} setting total spots to ${totalSpots}...`);
    
    mockDB.parkingConfig = {
      id: 'config',
      totalSpots,
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };
    
    console.log('✅ Config saved:', mockDB.parkingConfig);
    return { success: true, data: mockDB.parkingConfig };
  },

  // Resident: Register
  registerResident: (email, floor, plate) => {
    console.log(`\n👤 Registering resident: ${email}...`);
    
    // Check if exists
    const exists = mockDB.residents.find(r => r.email === email);
    if (exists) {
      console.log('❌ Resident already exists');
      return { success: false, error: 'Resident already exists' };
    }
    
    const resident = {
      id: generateId(),
      email,
      floor,
      plate,
      residentCode: generateResidentCode(),
      createdAt: new Date().toISOString()
    };
    
    mockDB.residents.push(resident);
    console.log('✅ Resident registered:', resident);
    return { success: true, data: resident };
  },

  // Resident: Get by Code
  getResidentByCode: (residentCode) => {
    console.log(`\n🔍 Looking for resident with code: ${residentCode}...`);
    
    const resident = mockDB.residents.find(r => r.residentCode === residentCode);
    
    if (!resident) {
      console.log('❌ Resident not found');
      return { success: false, error: 'Invalid resident code' };
    }
    
    console.log('✅ Resident found:', resident);
    return { success: true, data: resident };
  },

  // Guest: Check Availability
  checkAvailability: () => {
    console.log(`\n📊 Checking parking availability...`);
    
    if (!mockDB.parkingConfig) {
      console.log('❌ Parking not configured');
      return { success: false, error: 'Parking not configured' };
    }
    
    const now = new Date();
    const activeReservations = mockDB.reservations.filter(
      r => new Date(r.endTime) > now
    );
    
    const totalSpots = mockDB.parkingConfig.totalSpots;
    const availableSpots = totalSpots - activeReservations.length;
    
    if (availableSpots > 0) {
      console.log(`✅ ${availableSpots}/${totalSpots} spots available`);
      return {
        success: true,
        data: {
          available: true,
          availableSpots,
          totalSpots,
          message: `${availableSpots} جای پارک خالی است`
        }
      };
    }
    
    // Find earliest ending reservation
    const sorted = activeReservations.sort(
      (a, b) => new Date(a.endTime) - new Date(b.endTime)
    );
    const nextAvailableTime = sorted[0]?.endTime;
    
    console.log(`⚠️  All spots full. Next available: ${nextAvailableTime}`);
    return {
      success: true,
      data: {
        available: false,
        availableSpots: 0,
        totalSpots,
        nextAvailableTime,
        message: 'همه جاها پر است'
      }
    };
  },

  // Guest: Create Reservation
  createReservation: (residentCode, guestPlate, guestMobile, guestEmail, endTime) => {
    console.log(`\n🚗 Creating reservation for guest ${guestPlate}...`);
    
    // Verify resident code
    const resident = mockDB.residents.find(r => r.residentCode === residentCode);
    if (!resident) {
      console.log('❌ Invalid resident code');
      return { success: false, error: 'Invalid resident code' };
    }
    
    // Check availability
    const availability = API.checkAvailability();
    if (!availability.data.available) {
      console.log('❌ No parking spots available');
      return { 
        success: false, 
        error: 'All parking spots are full',
        nextAvailableTime: availability.data.nextAvailableTime
      };
    }
    
    const reservation = {
      id: generateId(),
      residentId: resident.id,
      residentCode,
      residentFloor: resident.floor,
      residentPlate: resident.plate,
      guestPlate,
      guestMobile,
      guestEmail,
      startTime: new Date().toISOString(),
      endTime: new Date(endTime).toISOString(),
      createdAt: new Date().toISOString()
    };
    
    mockDB.reservations.push(reservation);
    console.log('✅ Reservation created:', reservation);
    return { success: true, data: reservation };
  },

  // Debug: Show all data
  showAllData: () => {
    console.log('\n📚 Current Database State:');
    console.log('Config:', mockDB.parkingConfig);
    console.log('Residents:', mockDB.residents.length);
    console.log('Reservations:', mockDB.reservations.length);
    mockDB.reservations.forEach(r => {
      console.log(`  - ${r.guestPlate} until ${r.endTime}`);
    });
  }
};

// Run Tests
console.log('='.repeat(60));
console.log('TEST 1: Admin sets total parking spots');
console.log('='.repeat(60));
API.setTotalSpots(5);

console.log('\n' + '='.repeat(60));
console.log('TEST 2: Resident Registration');
console.log('='.repeat(60));
const res1 = API.registerResident('resident1@example.com', '5', 'ABC123');
const res2 = API.registerResident('resident2@example.com', '3', 'XYZ789');

console.log('\n' + '='.repeat(60));
console.log('TEST 3: Check Availability (should have 5 spots)');
console.log('='.repeat(60));
API.checkAvailability();

console.log('\n' + '='.repeat(60));
console.log('TEST 4: Guest Reservations (fill 5 spots)');
console.log('='.repeat(60));

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

for (let i = 1; i <= 5; i++) {
  API.createReservation(
    res1.data.residentCode,
    `GUEST-${i}`,
    `0912345678${i}`,
    `guest${i}@example.com`,
    tomorrow
  );
}

console.log('\n' + '='.repeat(60));
console.log('TEST 5: Check Availability (should be full now)');
console.log('='.repeat(60));
API.checkAvailability();

console.log('\n' + '='.repeat(60));
console.log('TEST 6: Try to add 6th reservation (should fail)');
console.log('='.repeat(60));
API.createReservation(
  res2.data.residentCode,
  'GUEST-6',
  '09123456786',
  'guest6@example.com',
  tomorrow
);

console.log('\n' + '='.repeat(60));
console.log('TEST 7: Search Resident by Code');
console.log('='.repeat(60));
API.getResidentByCode(res1.data.residentCode);
API.getResidentByCode('INVALID123');

console.log('\n' + '='.repeat(60));
console.log('TEST 8: Database Summary');
console.log('='.repeat(60));
API.showAllData();

console.log('\n' + '='.repeat(60));
console.log('✅ همه تست‌ها با موفقیت اجرا شدند!');
console.log('='.repeat(60));
console.log('\nنکته: این تست‌ها logic سیستم را بدون AWS تست می‌کنند.');
console.log('برای تست کامل با AWS، باید backend را deploy کنید.');
