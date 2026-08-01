# معماری سیستم

## نمای کلی

این سیستم یک Full-Stack Application است که به طور کامل روی AWS بالا آمده است.

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Amplify Hosting                     │
│                    (CloudFront + S3)                         │
│                   React Frontend (Vite)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ GraphQL API (authenticated)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                     AWS AppSync                              │
│                   (GraphQL API)                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Resolvers:                                         │    │
│  │  - Admin: setTotalSpots                            │    │
│  │  - Resident: register, getCode                      │    │
│  │  - Guest: createReservation, checkAvailability      │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────┴───────────┬─────────────┐
           │                       │             │
┌──────────▼────────┐  ┌──────────▼─────────┐  │
│  Amazon Cognito   │  │   Amazon DynamoDB  │  │
│                   │  │                    │  │
│  - User Pools     │  │  Tables:           │  │
│  - Groups:        │  │  - ParkingConfig   │  │
│    * ADMIN        │  │  - Resident        │  │
│    * RESIDENT     │  │  - Reservation     │  │
│                   │  │                    │  │
│  - Custom Attrs:  │  │  Authorization:    │  │
│    * floor        │  │  - Owner-based     │  │
│    * plate        │  │  - Group-based     │  │
│    * residentCode │  │  - Public API Key  │  │
└───────────────────┘  └────────────────────┘  │
                                                │
                       ┌────────────────────────┘
                       │
            ┌──────────▼────────────┐
            │   AWS Lambda          │
            │  (Custom Resolvers)   │
            │                       │
            │  - checkAvailability  │
            └───────────────────────┘
```

## Region: ca-central-1 (Montreal, Canada)

همه سرویس‌ها در این region قرار دارند.

## Components

### 1. Frontend (React + TypeScript)

**فایل‌های اصلی:**
- `src/App.tsx` - کامپوننت اصلی و routing
- `src/components/AdminPanel.tsx` - پنل مدیر
- `src/components/ResidentPanel.tsx` - پنل ساکن
- `src/components/GuestPanel.tsx` - پنل مهمان

**ویژگی‌ها:**
- Single Page Application (SPA)
- Tab-based navigation
- Real-time data updates
- QR Code generation/scanning
- Responsive design

**Technologies:**
- React 18
- TypeScript
- Vite (build tool)
- AWS Amplify UI Components

### 2. Backend (AWS Amplify Gen 2)

#### 2.1 Authentication (Amazon Cognito)

**User Groups:**
- `ADMIN`: مدیریت سیستم
- `RESIDENT`: ساکنین

**Custom Attributes:**
```typescript
{
  'custom:userType': 'ADMIN' | 'RESIDENT',
  'custom:floor': string,
  'custom:plate': string,
  'custom:residentCode': string (8 chars)
}
```

#### 2.2 Data Layer (DynamoDB)

**Table 1: ParkingConfig**
```typescript
{
  id: string (PK),
  totalSpots: number,
  updatedAt: datetime,
  updatedBy: string
}
```
Authorization: Admin (write), Public (read)

**Table 2: Resident**
```typescript
{
  id: string (PK),
  email: string,
  floor: string,
  plate: string,
  residentCode: string,
  userId: string,
  createdAt: datetime
}
```
Authorization: Owner (full), Admin (full), Public (read)

**Table 3: Reservation**
```typescript
{
  id: string (PK),
  residentId: string,
  residentCode: string,
  residentFloor: string,
  residentPlate: string,
  guestPlate: string,
  guestMobile: string,
  guestEmail: string,
  startTime: datetime,
  endTime: datetime (GSI),
  createdAt: datetime
}
```
Authorization: Public (full), Admin (full)

**Global Secondary Index:**
- `EndTimeIndex`: Query by endTime for finding next available slot

#### 2.3 API Layer (AWS AppSync GraphQL)

**Authorization Modes:**
1. API Key (Public access) - برای Guest operations
2. Cognito User Pools - برای Admin و Resident operations

**Key Queries:**
- `listParkingConfigs` - دریافت تنظیمات
- `listResidents` - لیست ساکنین
- `listReservations` - لیست رزروها
- `checkAvailability` - بررسی موجودی (Custom resolver)

**Key Mutations:**
- `createParkingConfig` / `updateParkingConfig` - تنظیم تعداد پارکینگ
- `createResident` - ثبت ساکن جدید
- `createReservation` - ایجاد رزرو جدید

#### 2.4 Custom Resolvers (Lambda)

**checkAvailability Function:**
```javascript
Input: None
Process:
  1. Get all active reservations (endTime > now)
  2. Get total spots from config
  3. Calculate available spots
  4. If full, find earliest ending reservation
Output: {
  available: boolean,
  availableSpots: number,
  totalSpots: number,
  nextAvailableTime: datetime | null,
  message: string
}
```

## Workflow جریان کار

### Admin Workflow

```mermaid
Admin Login → Authenticate (Cognito) → Set Total Spots → Update DynamoDB
```

1. Admin login با email/password
2. Cognito بررسی می‌کند کاربر در گروه ADMIN است
3. Admin تعداد کل جای پارک را وارد می‌کند
4. AppSync mutation به DynamoDB می‌نویسد
5. ParkingConfig record بروز می‌شود

### Resident Workflow

```mermaid
Resident Register → Auth → Complete Profile → Generate Code → Store in Cognito + DynamoDB
```

1. Resident ثبت‌نام می‌کند (email, password)
2. Cognito user pool کاربر را ایجاد می‌کند
3. کاربر اطلاعات تکمیلی (floor, plate) را وارد می‌کند
4. سیستم residentCode 8 رقمی تولید می‌کند
5. Custom attributes در Cognito بروز می‌شود
6. Record در DynamoDB ذخیره می‌شود
7. QR Code تولید می‌شود (Frontend)

### Guest Workflow

```mermaid
Guest → Scan QR / Enter Code → Check Availability → Create Reservation → Store in DynamoDB
```

1. Guest کد ساکن را می‌گیرد (QR scan یا دستی)
2. سیستم بررسی می‌کند کد معتبر است
3. سیستم availability را چک می‌کند
4. اگر جای خالی هست، فرم رزرو نمایش داده می‌شود
5. Guest اطلاعات (plate, mobile, email, endTime) را وارد می‌کند
6. سیستم دوباره availability را چک می‌کند (race condition prevention)
7. Reservation record در DynamoDB ذخیره می‌شود

### Availability Check Logic

```javascript
function checkAvailability() {
  const now = Date.now();
  const totalSpots = getParkingConfig().totalSpots;
  const activeReservations = getReservations()
    .filter(r => r.endTime > now);
  
  const availableSpots = totalSpots - activeReservations.length;
  
  if (availableSpots > 0) {
    return {
      available: true,
      availableSpots,
      totalSpots,
      message: `${availableSpots} جای خالی`
    };
  }
  
  // Find earliest ending reservation
  const sorted = activeReservations.sort((a, b) => a.endTime - b.endTime);
  const nextAvailableTime = sorted[0].endTime;
  
  return {
    available: false,
    availableSpots: 0,
    totalSpots,
    nextAvailableTime,
    message: 'همه جاها پر است'
  };
}
```

## Security

### Authentication
- ✅ Email/Password با Cognito
- ✅ MFA قابل فعال‌سازی
- ✅ Password policy: حداقل 8 کاراکتر

### Authorization
- ✅ Group-based: ADMIN, RESIDENT
- ✅ Owner-based: هر Resident فقط data خودش را می‌بیند
- ✅ Public API Key: برای Guest operations (time-limited)

### Data Protection
- ✅ Encryption at rest (DynamoDB)
- ✅ Encryption in transit (HTTPS/TLS)
- ✅ IAM roles با least privilege
- ✅ CloudWatch logging

## Scalability

**DynamoDB:**
- On-demand billing mode
- Auto-scaling برای traffic bursts
- TTL برای cleanup رزروهای expired (قابل فعال‌سازی)

**AppSync:**
- Caching capability
- Rate limiting
- Automatic scaling

**Cognito:**
- رایگان تا 50,000 MAU
- Auto-scaling

**Hosting:**
- CloudFront CDN
- S3 static hosting
- Global edge locations

## Monitoring

**CloudWatch Metrics:**
- API request count
- Error rates
- Latency
- DynamoDB read/write capacity

**CloudWatch Logs:**
- Lambda execution logs
- AppSync resolver logs
- Authentication events

**Alarms:**
می‌توانید برای موارد زیر alarm تنظیم کنید:
- High error rate
- High latency
- DynamoDB throttling
- Cognito failed logins

## Cost Optimization

**Free Tier:**
- Cognito: 50K MAU
- DynamoDB: 25GB storage + 25 RCU/WCU
- Lambda: 1M requests/month
- S3: 5GB storage
- CloudFront: 1TB data transfer

**Estimated Monthly Cost (1000 users):**
- Amplify Hosting: $0-5
- AppSync: $4 (1M requests)
- DynamoDB: $1 (under free tier)
- Cognito: $0 (under free tier)
- Lambda: $0 (under free tier)

**Total: ~$5-10/month**

## Development vs Production

### Development (Sandbox)
```bash
npx ampx sandbox
```
- Temporary resources
- Fast iteration
- Isolated per developer
- Auto-cleanup on exit

### Production
```bash
npx ampx deploy --branch main
```
- Persistent resources
- Production-grade infrastructure
- CloudFormation stack
- Manual cleanup required

## Future Enhancements

**Phase 2:**
- [ ] Email/SMS notifications
- [ ] Payment integration
- [ ] Reservation history
- [ ] Admin dashboard با charts
- [ ] Export reports (CSV/PDF)

**Phase 3:**
- [ ] Mobile app (React Native)
- [ ] IoT integration (smart barriers)
- [ ] Real-time availability updates (WebSocket)
- [ ] Multi-tenancy (multiple parking lots)

---

این معماری برای production-ready است و می‌تواند تا هزاران کاربر scale شود.
