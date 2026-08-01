# 🅿️ سیستم مدیریت پارکینگ با AWS Amplify Gen 2

یک سیستم کامل مدیریت پارکینگ با استفاده از AWS Amplify Gen 2 که شامل Authentication، GraphQL API، DynamoDB و Hosting است.

## ویژگی‌ها

### 👤 مدیر (Admin)
- لاگین با Cognito
- تعیین تعداد کل جای پارک

### 🏠 ساکنین (Residents)
- ثبت‌نام و لاگین با Amplify Auth
- ثبت طبقه و پلاک خودرو
- دریافت کد اختصاصی 8 رقمی
- تولید QR Code برای به اشتراک‌گذاری با مهمان‌ها

### 🚗 مهمان‌ها (Guests)
- رزرو بدون لاگین
- اسکن QR Code یا وارد کردن دستی کد ساکن
- ثبت پلاک، موبایل، ایمیل و زمان پارک
- نمایش وضعیت پارکینگ (خالی / پر)
- در صورت پر بودن، نمایش زمان خالی شدن اولین پارکینگ

## سرویس‌های AWS استفاده شده

1. **AWS Amplify Hosting** - هاست فرانت‌اند
2. **Amazon Cognito** - Authentication (لاگین/ثبت‌نام)
3. **AWS AppSync** - GraphQL API
4. **Amazon DynamoDB** - دیتابیس NoSQL
5. **AWS Lambda** - Serverless Functions (در صورت نیاز)
6. **Amazon CloudFront** - CDN برای توزیع محتوا

## Region
همه سرویس‌ها در **ca-central-1** (کانادا - مونترال) دیپلوی می‌شوند.

## نصب و راه‌اندازی

### پیش‌نیازها
```bash
# نصب Node.js (نسخه 18 یا بالاتر)
# نصب npm یا yarn

# نصب AWS CLI
# پیکربندی AWS credentials:
aws configure
```

### مراحل نصب

1. **کلون کردن پروژه**
```bash
git clone <repository-url>
cd parking-management-amplify
```

2. **نصب Dependencies**
```bash
npm install
```

3. **راه‌اندازی Amplify Backend**
```bash
npx amplify sandbox
```

این دستور backend را به صورت development mode اجرا می‌کند.

4. **اجرای Frontend**
```bash
npm run dev
```

Frontend در آدرس `http://localhost:3000` در دسترس خواهد بود.

## Deploy به Production

### 1. Deploy Backend
```bash
npx amplify deploy
```

### 2. Deploy Frontend (Amplify Hosting)

#### روش اول: از طریق Console
1. به AWS Amplify Console بروید
2. "New app" > "Host web app" را انتخاب کنید
3. Repository خود را متصل کنید
4. Branch را انتخاب کنید
5. Build settings به صورت خودکار تشخیص داده می‌شود
6. "Save and deploy" را بزنید

#### روش دوم: از طریق CLI
```bash
# اتصال به Git repository
npx amplify hosting add

# Deploy
npx amplify publish
```

## ایجاد کاربر Admin

بعد از deploy کردن، باید یک کاربر Admin ایجاد کنید:

1. به AWS Cognito Console بروید
2. User Pool مربوط به پروژه را انتخاب کنید
3. یک کاربر جدید ایجاد کنید
4. کاربر را به گروه "ADMIN" اضافه کنید

یا از AWS CLI:

```bash
# ایجاد کاربر
aws cognito-idp admin-create-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin@parking.com \
  --temporary-password TempPass123! \
  --region ca-central-1

# اضافه کردن به گروه ADMIN
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin@parking.com \
  --group-name ADMIN \
  --region ca-central-1
```

## ساختار پروژه

```
parking-management-amplify/
├── amplify/
│   ├── auth/
│   │   └── resource.ts         # تنظیمات Cognito
│   ├── data/
│   │   ├── resource.ts         # Schema دیتابیس
│   │   └── checkAvailability.js # Custom resolver
│   └── backend.ts              # تنظیمات کلی backend
├── src/
│   ├── components/
│   │   ├── AdminPanel.tsx      # پنل مدیر
│   │   ├── ResidentPanel.tsx   # پنل ساکن
│   │   └── GuestPanel.tsx      # پنل مهمان
│   ├── App.tsx                 # کامپوننت اصلی
│   ├── main.tsx                # Entry point
│   └── App.css                 # استایل‌ها
├── index.html
├── package.json
└── vite.config.ts
```

## Models (DynamoDB Tables)

### 1. ParkingConfig
- `id`: String (Primary Key)
- `totalSpots`: Number
- `updatedAt`: DateTime
- `updatedBy`: String

### 2. Resident
- `id`: String (Primary Key)
- `email`: Email
- `floor`: String
- `plate`: String
- `residentCode`: String (8 characters)
- `userId`: String
- `createdAt`: DateTime

### 3. Reservation
- `id`: String (Primary Key)
- `residentId`: String
- `residentCode`: String
- `residentFloor`: String
- `residentPlate`: String
- `guestPlate`: String
- `guestMobile`: Phone
- `guestEmail`: Email
- `startTime`: DateTime
- `endTime`: DateTime
- `createdAt`: DateTime

## Authorization Rules

### ParkingConfig
- Admin: Full access
- Public (API Key): Read only

### Resident
- Owner: Full access
- Admin: Full access
- Public (API Key): Read only

### Reservation
- Public (API Key): Full access
- Admin: Full access

## نکات امنیتی در Production

1. **API Key Expiration**: API Key پیش‌فرض 365 روز اعتبار دارد. برای production مناسب‌تر است.

2. **Validation**: در backend validation بیشتری اضافه کنید.

3. **Rate Limiting**: برای جلوگیری از abuse، rate limiting فعال کنید.

4. **Monitoring**: از CloudWatch برای monitoring استفاده کنید.

5. **Backup**: برای DynamoDB tables، backup فعال کنید.

## هزینه‌ها (تخمینی)

- **Amplify Hosting**: رایگان تا 1000 build minutes/month
- **Cognito**: رایگان تا 50,000 MAU
- **AppSync**: $4 per million requests
- **DynamoDB**: Free tier شامل 25GB storage
- **CloudFront**: رایگان تا 1TB transfer/month

## پشتیبانی

برای مشکلات و سوالات، لطفاً issue ایجاد کنید.

## لایسنس

MIT
