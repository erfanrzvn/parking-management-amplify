# 🚀 شروع کار با سیستم مدیریت پارکینگ

## ✅ پروژه شما آماده است!

این یک سیستم کامل مدیریت پارکینگ است که روی **AWS Amplify Gen 2** ساخته شده.

---

## 📁 فایل‌های مهم

- **README.md** - توضیحات کامل پروژه
- **QUICK_START.md** - ⭐ راهنمای سریع شروع کار (از اینجا شروع کنید)
- **DEPLOYMENT_GUIDE.md** - راهنمای مرحله به مرحله deploy
- **ARCHITECTURE.md** - معماری و جزئیات فنی
- **API_EXAMPLES.md** - نمونه APIها (اگر نیاز دارید)

---

## 🎯 سه مرحله برای شروع

### مرحله 1: نصب Dependencies
```bash
npm install
```

### مرحله 2: راه‌اندازی Backend
```bash
npx ampx sandbox
```
منتظر بمانید تا "Deployed" نمایش داده شود (3-5 دقیقه)

### مرحله 3: اجرای Frontend
در ترمینال جدید:
```bash
npm run dev
```

برو به: http://localhost:3000

---

## 🎨 ویژگی‌های سیستم

### 1️⃣ پنل مدیر (Admin)
- تنظیم تعداد کل جای پارک
- Authentication با Cognito

### 2️⃣ پنل ساکنین (Residents)
- ثبت‌نام و لاگین
- ثبت طبقه و پلاک
- دریافت کد اختصاصی 8 رقمی
- تولید QR Code برای مهمان‌ها

### 3️⃣ پنل مهمان (Guests)
- رزرو بدون لاگین
- اسکن QR Code یا وارد کردن کد دستی
- ثبت پلاک، موبایل، ایمیل و زمان پارک
- نمایش وضعیت پارکینگ (خالی/پر)
- در صورت پر بودن، نمایش زمان خالی شدن اولین پارکینگ

---

## 🛠 سرویس‌های AWS

✅ **Amazon Cognito** - Authentication & User Management
✅ **AWS AppSync** - GraphQL API
✅ **Amazon DynamoDB** - NoSQL Database
✅ **AWS Amplify Hosting** - Static Site Hosting
✅ **Amazon CloudFront** - CDN
✅ **AWS Lambda** - Custom Resolvers

**Region:** ca-central-1 (Montreal, Canada)

---

## 📊 Database Schema

### ParkingConfig
- تعداد کل جای پارک

### Resident  
- ایمیل، طبقه، پلاک، کد اختصاصی

### Reservation
- اطلاعات رزرو: ساکن، مهمان، زمان شروع/پایان

---

## 🔐 امنیت

- ✅ Authentication با Cognito User Pools
- ✅ Authorization: Group-based (ADMIN, RESIDENT)
- ✅ Encryption at rest & in transit
- ✅ Public API Key برای Guest operations

---

## 💰 هزینه تقریبی

**برای 1000 کاربر در ماه: $5-10**

- Cognito: رایگان (زیر 50K MAU)
- AppSync: ~$4
- DynamoDB: ~$1
- Amplify Hosting: $0-5

---

## 🚀 Deploy به Production

### Backend
```bash
npx ampx deploy --branch main
```

### Frontend
```bash
npx ampx hosting add
npx ampx publish
```

---

## 📝 بعد از Deploy

### 1. ایجاد Admin User

```bash
# پیدا کردن User Pool ID
aws cognito-idp list-user-pools --max-results 10 --region ca-central-1

# ایجاد admin
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_POOL_ID \
  --username admin@parking.com \
  --user-attributes Name=email,Value=admin@parking.com Name=email_verified,Value=true \
  --temporary-password Admin123! \
  --region ca-central-1

# اضافه به گروه ADMIN
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_POOL_ID \
  --username admin@parking.com \
  --group-name ADMIN \
  --region ca-central-1
```

### 2. تست سیستم

1. **Admin Login** → تنظیم 20 جای پارک
2. **Resident Register** → دریافت QR Code
3. **Guest Reservation** → رزرو با کد ساکن

---

## 🆘 مشکلات رایج

### npm install طولانی است
```bash
npm install --legacy-peer-deps
```

### amplify_outputs.json پیدا نمیشه
```bash
npx ampx sandbox
```

### Backend متصل نیست
1. مطمئن شوید sandbox در حال اجرا است
2. Frontend را restart کنید
3. چک کنید `amplify_outputs.json` وجود دارد

---

## 📚 اطلاعات بیشتر

- **QUICK_START.md** - راهنمای سریع
- **DEPLOYMENT_GUIDE.md** - راهنمای کامل deploy
- **ARCHITECTURE.md** - جزئیات فنی

---

## 🎉 موفق باشید!

پروژه شما آماده است. برای شروع:

```bash
npm install
npx ampx sandbox
npm run dev  # در ترمینال دیگر
```

سپس برو به http://localhost:3000 و لذت ببر! 🚗🅿️

---

**نکته:** اگر سوالی داشتید، تمام فایل‌های مستندات را مطالعه کنید.
