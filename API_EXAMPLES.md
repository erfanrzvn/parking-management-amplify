# نمونه‌های فراخوانی API

## قبل از شروع

ابتدا باید Admin ایجاد کنید:

```bash
# بعد از deploy، Admin را با اجرای اسکریپت ایجاد کنید
node scripts/create-admin.js
```

---

## 1. Admin Login

```bash
curl -X POST https://YOUR-API-GATEWAY-URL/dev/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@parking.com",
    "password": "admin123"
  }'
```

**پاسخ:**
```json
{
  "message": "Login successful",
  "adminId": "xxx-xxx-xxx",
  "email": "admin@parking.com",
  "token": "xxx-xxx-xxx"
}
```

---

## 2. Set Total Parking Spots (Admin)

```bash
curl -X POST https://YOUR-API-GATEWAY-URL/dev/admin/parking-spots \
  -H "Content-Type: application/json" \
  -d '{
    "totalSpots": 20,
    "adminId": "ADMIN_ID_FROM_LOGIN"
  }'
```

**پاسخ:**
```json
{
  "message": "Total parking spots configured successfully",
  "totalSpots": 20
}
```

---

## 3. Resident Register

```bash
curl -X POST https://YOUR-API-GATEWAY-URL/dev/resident/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "resident1@example.com",
    "password": "pass123",
    "floor": "5",
    "plate": "ABC123"
  }'
```

**پاسخ:**
```json
{
  "message": "Resident registered successfully",
  "residentId": "xxx-xxx-xxx",
  "email": "resident1@example.com",
  "floor": "5",
  "plate": "ABC123",
  "residentCode": "A1B2C3D4"
}
```

---

## 4. Resident Login

```bash
curl -X POST https://YOUR-API-GATEWAY-URL/dev/resident/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "resident1@example.com",
    "password": "pass123"
  }'
```

**پاسخ:**
```json
{
  "message": "Login successful",
  "residentId": "xxx-xxx-xxx",
  "email": "resident1@example.com",
  "floor": "5",
  "plate": "ABC123",
  "residentCode": "A1B2C3D4",
  "token": "xxx-xxx-xxx"
}
```

---

## 5. Get Resident Code (با QR Code)

```bash
curl -X GET "https://YOUR-API-GATEWAY-URL/dev/resident/code?residentId=RESIDENT_ID"
```

**پاسخ:**
```json
{
  "residentCode": "A1B2C3D4",
  "floor": "5",
  "plate": "ABC123",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

---

## 6. Scan QR Code (Guest)

```bash
curl -X POST https://YOUR-API-GATEWAY-URL/dev/guest/scan \
  -H "Content-Type: application/json" \
  -d '{
    "qrData": "{\"residentCode\":\"A1B2C3D4\",\"residentId\":\"xxx-xxx-xxx\",\"floor\":\"5\",\"plate\":\"ABC123\"}"
  }'
```

**پاسخ:**
```json
{
  "message": "QR code scanned successfully",
  "residentCode": "A1B2C3D4",
  "residentId": "xxx-xxx-xxx",
  "floor": "5",
  "plate": "ABC123"
}
```

---

## 7. Check Parking Availability

```bash
curl -X GET https://YOUR-API-GATEWAY-URL/dev/guest/availability
```

**پاسخ (موجود):**
```json
{
  "available": true,
  "availableSpots": 5,
  "totalSpots": 20,
  "message": "5 parking spot(s) available"
}
```

**پاسخ (پر):**
```json
{
  "available": false,
  "availableSpots": 0,
  "totalSpots": 20,
  "nextAvailableTime": 1735689600000,
  "nextAvailableDate": "2025-01-01T12:00:00.000Z",
  "message": "All parking spots are full"
}
```

---

## 8. Create Guest Reservation

```bash
curl -X POST https://YOUR-API-GATEWAY-URL/dev/guest/reservation \
  -H "Content-Type: application/json" \
  -d '{
    "residentCode": "A1B2C3D4",
    "plate": "XYZ789",
    "mobile": "09123456789",
    "email": "guest@example.com",
    "endTime": "2026-08-01T20:00:00.000Z"
  }'
```

**پاسخ (موفق):**
```json
{
  "message": "Reservation created successfully",
  "reservationId": "xxx-xxx-xxx",
  "guestPlate": "XYZ789",
  "guestMobile": "09123456789",
  "guestEmail": "guest@example.com",
  "startTime": "2026-08-01T10:00:00.000Z",
  "endTime": "2026-08-01T20:00:00.000Z",
  "residentFloor": "5",
  "residentPlate": "ABC123"
}
```

**پاسخ (پر):**
```json
{
  "error": "{\"message\":\"All parking spots are full\",\"nextAvailableTime\":1735689600000,\"nextAvailableDate\":\"2025-01-01T12:00:00.000Z\"}"
}
```

---

## 9. Get Next Available Time

```bash
curl -X GET https://YOUR-API-GATEWAY-URL/dev/parking/next-available
```

**پاسخ (پر):**
```json
{
  "available": false,
  "availableSpots": 0,
  "totalSpots": 20,
  "nextAvailableTime": 1735689600000,
  "nextAvailableDate": "2025-01-01T12:00:00.000Z",
  "message": "All parking spots are currently full. Next available time shown above."
}
```
