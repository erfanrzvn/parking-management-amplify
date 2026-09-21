# 🧪 Local API Tester - راهنمای استفاده

## 📋 توضیحات

این فایل برای تست کامل API های پروژه **بدون نیاز به deploy** است.

## 🚀 نصب و اجرا

### پیش نیاز
```bash
# نیازی به نصب npm packages نیست!
# فقط Node.js باید نصب باشه
node --version  # باید v14 یا بالاتر باشه
```

### اجرا
```bash
# تست همه API ها
node API-TEST-LOCAL.js
```

## 📊 خروجی نمونه

```
🚀 Starting Parking Management API Tests...

📡 API Endpoint: https://q7eguqs26vdwpjw7hf3jekqvvu.appsync-api...
🔑 API Key: da2-htffbvr7enbyh...

======================================================================
  🏢 PARKING CONFIG TESTS
======================================================================

✅ Listed 2 parking configs
  📍 Main Parking: 20 spots
  📍 Guest Parking: 10 spots
✅ Created parking: Test Parking Lot
✅ Listed 3 parking configs

======================================================================
  👥 RESIDENT TESTS
======================================================================

✅ Listed 5 active residents
  👤 John Doe - Unit 101 - Code: RESABC123
  👤 Jane Smith - Unit 202 - Code: RESDEF456
✅ Created resident: Test User (RESXYZ789)
✅ Updated resident: res-123...
✅ Listed 6 active residents

======================================================================
  🅿️ RESERVATION TESTS
======================================================================

✅ Listed 3 active reservations
  🅿️ GUEST789 (RESABC123) - 2026-09-21 14:00
✅ Created reservation: GUEST999
✅ Extended reservation by 2h: res-456...
✅ Cancelled reservation: res-456...
✅ Listed 3 active reservations

======================================================================
  🧹 CLEANUP
======================================================================

✅ Deleted parking config: pk-789...
✅ Soft deleted resident: res-123...

======================================================================
  📊 TEST SUMMARY
======================================================================

✅ All API tests completed!
ℹ️ Check the output above for any errors
```

## 🔧 API های موجود

### 🏢 Parking Config

#### List All Parking Configs
```javascript
const parkings = await testListParkingConfigs();
```

#### Create Parking
```javascript
const newParking = await testCreateParkingConfig('Main Parking', 25);
// Returns: { id, name, totalSpots }
```

#### Delete Parking
```javascript
const success = await testDeleteParkingConfig('parking-id-123');
```

---

### 👥 Residents

#### List All Residents
```javascript
const residents = await testListResidents();
```

#### Create Resident
```javascript
const resident = await testCreateResident(
  'user@example.com',  // email
  'John Doe',          // name
  'Building A',        // building
  '5',                 // floor
  '502',               // unitNumber
  'ABC123'             // plate
);
// Returns: { id, email, name, residentCode }
```

#### Update Resident
```javascript
const updated = await testUpdateResident('resident-id', {
  name: 'Jane Doe',
  phone: '+989121234567'
});
```

#### Delete Resident (Soft Delete)
```javascript
const success = await testDeleteResident('resident-id');
```

---

### 🅿️ Reservations

#### List All Reservations
```javascript
const reservations = await testListReservations();
```

#### Create Reservation
```javascript
const start = new Date();
const end = new Date(start.getTime() + 3 * 3600000); // +3 hours

const reservation = await testCreateReservation(
  'RES12345',           // residentCode
  'GUEST999',           // guestPlate
  '+989121234567',      // guestMobile
  'guest@example.com',  // guestEmail
  start,                // startTime
  end                   // endTime
);
```

#### Extend Reservation Time ⭐ جدید
```javascript
const extended = await testExtendReservation('reservation-id', 2); // +2 hours
```

#### Cancel Reservation
```javascript
const success = await testCancelReservation('reservation-id');
```

## 💡 مثال‌های کاربردی

### مثال 1: تست کامل یک سناریو
```javascript
const { 
  testCreateResident, 
  testCreateReservation,
  testExtendReservation,
  testCancelReservation 
} = require('./API-TEST-LOCAL');

async function testFullWorkflow() {
  // 1. ساخت ساکن
  const resident = await testCreateResident(
    'test@example.com',
    'Test User',
    'Building A',
    '5',
    '502',
    'ABC123'
  );
  
  console.log('Resident Code:', resident.residentCode);
  
  // 2. ساخت رزرو با کد ساکن
  const start = new Date();
  const end = new Date(start.getTime() + 2 * 3600000);
  
  const reservation = await testCreateReservation(
    resident.residentCode,
    'GUEST-TEST',
    '+989121234567',
    'guest@test.com',
    start,
    end
  );
  
  console.log('Reservation created:', reservation.id);
  
  // 3. افزایش 1 ساعت
  await testExtendReservation(reservation.id, 1);
  
  // 4. لغو رزرو
  await testCancelReservation(reservation.id);
}

testFullWorkflow();
```

### مثال 2: تست فقط Parking Config
```javascript
const { testListParkingConfigs, testCreateParkingConfig } = require('./API-TEST-LOCAL');

async function manageParkings() {
  // لیست فعلی
  const current = await testListParkingConfigs();
  console.log('Current parkings:', current.length);
  
  // اضافه کردن جدید
  await testCreateParkingConfig('VIP Parking', 5);
  
  // لیست بعد از اضافه
  const updated = await testListParkingConfigs();
  console.log('After adding:', updated.length);
}

manageParkings();
```

## 🐛 عیب‌یابی

### Error: "Unauthorized" (401)
```
❌ Error: Unauthorized
```
**راه حل:** API key منقضی شده. آپدیت کن در فایل:
```javascript
const CONFIG = {
  API_KEY: 'da2-YOUR-NEW-KEY-HERE'
};
```

### Error: "Field undefined"
```
❌ Error: Field 'listReservations' undefined
```
**راه حل:** Query name اشتباه است. Schema رو چک کن.

### Error: "Network request failed"
```
❌ Error: Network request failed
```
**راه حل:** 
1. اینترنت متصل است؟
2. API URL درست است؟
3. AWS region درست است؟

## ⚠️ نکات مهم

1. **این فایل commit نمیشه!**
   - در `.gitignore` اضافه شده
   - فقط برای تست local است

2. **API Key Exposed**
   - این فایل API key داره
   - هیچوقت public نکن!

3. **Cleanup**
   - فایل خودش cleanup میکنه
   - ولی اگه error شد، manual پاک کن

4. **Rate Limiting**
   - خیلی زیاد تست نکن
   - ممکنه rate limit بخوری

## 📚 منابع

- [PROJECT-REFERENCE.txt](./PROJECT-REFERENCE.txt) - مرجع کامل پروژه
- [SECURITY-RULES.md](./SECURITY-RULES.md) - قوانین امنیتی
- [AWS AppSync Docs](https://docs.aws.amazon.com/appsync/)

## 🆘 کمک

اگه مشکلی داری:
1. `PROJECT-REFERENCE.txt` رو بخون
2. Error message رو دقیق بخون
3. Console output رو چک کن
4. AWS Console رو چک کن

---

**آخرین بروزرسانی:** 2026-09-21
