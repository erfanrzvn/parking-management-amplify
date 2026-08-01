# راهنمای سریع راه‌اندازی

## چیزهایی که نیاز دارید

1. **Node.js** نسخه 18 یا بالاتر
2. **AWS Account** و AWS CLI پیکربندی شده
3. **Git** برای version control

## مراحل راه‌اندازی

### 1. نصب Dependencies

در یک ترمینال باز کنید و در پوشه پروژه اجرا کنید:

```bash
npm install
```

**نکته:** اگر خطا داد یا خیلی طول کشید، می‌توانید به صورت دستی packages را نصب کنید:

```bash
npm install --legacy-peer-deps
```

### 2. پیکربندی AWS

مطمئن شوید AWS CLI پیکربندی شده است:

```bash
aws configure
# Region: ca-central-1
```

### 3. راه‌اندازی Amplify Sandbox

```bash
npx ampx sandbox
```

این دستور backend را در حالت development اجرا می‌کند و فایل `amplify_outputs.json` را می‌سازد.

منتظر بمانید تا پیام "Deployed" نمایش داده شود (معمولاً 3-5 دقیقه طول می‌کشد).

### 4. اجرای Frontend

در یک ترمینال جدید:

```bash
npm run dev
```

Frontend در `http://localhost:3000` اجرا می‌شود.

### 5. ایجاد Admin User

1. به AWS Cognito Console بروید: https://console.aws.amazon.com/cognito
2. Region را ca-central-1 قرار دهید
3. User pool پروژه را پیدا کنید
4. یک کاربر ایجاد کنید و به گروه ADMIN اضافه کنید

یا از CLI:

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

### 6. تست سیستم

1. **تب مدیر**: لاگین با admin@parking.com و تنظیم تعداد پارکینگ
2. **تب ساکنین**: ثبت‌نام یک ساکن و دریافت QR Code
3. **تب مهمان**: رزرو با استفاده از کد ساکن

## Deploy به Production

```bash
npx ampx deploy --branch main
```

سپس برای host کردن فرانت‌اند:

```bash
npx ampx hosting add
npx ampx publish
```

## حل مشکلات رایج

### npm install خیلی طولانی است
```bash
npm install --legacy-peer-deps
```

### خطای "amplify_outputs.json not found"
```bash
npx ampx sandbox
```

### خطای AWS credentials
```bash
aws configure
# و مجدداً region را ca-central-1 قرار دهید
```

### Backend متصل نیست
مطمئن شوید:
1. `amplify_outputs.json` در root پروژه وجود دارد
2. Sandbox در حال اجرا است
3. Frontend restart شده است

## Commands مفید

```bash
# دیدن وضعیت
npx ampx status

# دیدن logs
npx ampx console

# پاک کردن همه چیز
npx ampx delete

# متوقف کردن sandbox
Ctrl+C در ترمینال sandbox
```

---

✅ حالا می‌توانید پروژه را استفاده کنید!

برای سوالات بیشتر به DEPLOYMENT_GUIDE.md مراجعه کنید.
