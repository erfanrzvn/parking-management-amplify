# راهنمای مرحله به مرحله Deploy

## مرحله 1: آماده‌سازی AWS Account

### 1.1 نصب AWS CLI
```bash
# Windows (با Chocolatey)
choco install awscli

# یا دانلود مستقیم از:
# https://aws.amazon.com/cli/
```

### 1.2 پیکربندی AWS Credentials
```bash
aws configure

# وارد کنید:
# AWS Access Key ID: [YOUR_ACCESS_KEY]
# AWS Secret Access Key: [YOUR_SECRET_KEY]
# Default region name: ca-central-1
# Default output format: json
```

## مرحله 2: نصب Dependencies

```bash
npm install
```

## مرحله 3: راه‌اندازی Backend (Development)

```bash
npx amplify sandbox
```

این دستور:
- CloudFormation stack ایجاد می‌کند
- Cognito User Pool و App Client می‌سازد
- AppSync API را راه‌اندازی می‌کند
- DynamoDB tables را ایجاد می‌کند
- فایل `amplify_outputs.json` را generate می‌کند

منتظر بمانید تا پیام "Deployed successfully" نمایش داده شود.

## مرحله 4: ایجاد Admin User

### روش 1: از طریق AWS Console

1. به https://console.aws.amazon.com/cognito بروید
2. Region را ca-central-1 قرار دهید
3. User pool مربوط به پروژه را پیدا کنید (نام آن شامل "amplify" است)
4. به Users > Create user بروید
5. اطلاعات زیر را وارد کنید:
   - Username: admin@parking.com
   - Email: admin@parking.com
   - Temporary password: Admin123!
   - Mark email as verified: ✓
6. به Groups برگردید و ADMIN group را باز کنید
7. کاربر admin@parking.com را به گروه اضافه کنید

### روش 2: از طریق AWS CLI

```bash
# دریافت User Pool ID
aws cognito-idp list-user-pools --max-results 10 --region ca-central-1

# ایجاد کاربر (USER_POOL_ID را جایگزین کنید)
aws cognito-idp admin-create-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin@parking.com \
  --user-attributes Name=email,Value=admin@parking.com Name=email_verified,Value=true \
  --temporary-password Admin123! \
  --region ca-central-1

# اضافه کردن به گروه ADMIN
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin@parking.com \
  --group-name ADMIN \
  --region ca-central-1
```

## مرحله 5: اجرای Frontend (Local)

```bash
npm run dev
```

Frontend در http://localhost:3000 اجرا می‌شود.

### تست Local:
1. تب "مدیر" را باز کنید
2. با admin@parking.com / Admin123! لاگین کنید
3. در اولین ورود، رمز را تغییر دهید
4. تعداد جای پارک را تنظیم کنید (مثلاً 20)

## مرحله 6: Deploy به Production

### 6.1 Deploy Backend

```bash
npx amplify deploy --branch main
```

### 6.2 Setup Amplify Hosting

#### از طریق Console:

1. به https://console.aws.amazon.com/amplify بروید
2. "Create new app" > "Host web app"
3. Source را انتخاب کنید:
   - اگر GitHub/GitLab دارید: Connect repository
   - اگر ندارید: "Deploy without Git provider"
4. Repository و Branch را انتخاب کنید
5. Build settings (خودکار تشخیص داده می‌شود):

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci
        - npx amplify deploy --branch $AWS_BRANCH
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

6. Environment variables را اضافه کنید (اگر نیاز بود)
7. "Save and deploy"

### 6.3 اتصال Domain (اختیاری)

1. در Amplify Console > App settings > Domain management
2. "Add domain"
3. Domain خود را وارد کنید
4. DNS records را در domain provider خود تنظیم کنید

## مرحله 7: تست Production

1. به URL Amplify بروید (مثلاً https://main.xxxxx.amplifyapp.com)
2. همه سه بخش را تست کنید:
   - Admin login و تنظیم spots
   - Resident register و دریافت QR code
   - Guest reservation بدون login

## مرحله 8: Monitoring و Maintenance

### CloudWatch Logs
```bash
# دیدن logs
aws logs tail /aws/lambda/amplify-xxxxx --follow --region ca-central-1
```

### DynamoDB Backup
```bash
# فعال کردن Point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name <TABLE_NAME> \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region ca-central-1
```

### Cost Explorer
- به AWS Cost Explorer بروید
- هزینه‌های روزانه را چک کنید
- Budget alert تنظیم کنید

## Troubleshooting

### خطا: "User pool doesn't exist"
```bash
# مطمئن شوید region درست است
aws configure get region
# باید ca-central-1 باشد
```

### خطا: "Access denied"
```bash
# بررسی IAM permissions
aws iam get-user
# مطمئن شوید AdministratorAccess دارید
```

### خطا: "amplify_outputs.json not found"
```bash
# دوباره sandbox را اجرا کنید
npx amplify sandbox
```

### Frontend build می‌شود اما backend متصل نیست
```bash
# مطمئن شوید amplify_outputs.json وجود دارد
ls amplify_outputs.json

# اگر نیست، دوباره deploy کنید
npx amplify deploy
```

## Commands مفید

```bash
# دیدن status backend
npx amplify status

# دیدن لیست resources
npx amplify list

# پاک کردن همه چیز
npx amplify delete

# دیدن logs
npx amplify console

# بروزرسانی backend بعد از تغییر schema
npx amplify push
```

## هزینه‌های تقریبی (برای 1000 کاربر در ماه)

- Amplify Hosting: $0-5
- Cognito: رایگان (زیر 50K MAU)
- AppSync: ~$4 (برای 1M requests)
- DynamoDB: ~$1 (زیر 25GB)
- CloudFront: رایگان (زیر 1TB transfer)

**جمع تقریبی: $5-10 در ماه**

## نکته مهم برای Production

⚠️ قبل از production، این کارها را حتماً انجام دهید:

1. [ ] Input validation را در frontend اضافه کنید
2. [ ] Rate limiting برای APIs فعال کنید
3. [ ] CloudWatch alarms تنظیم کنید
4. [ ] DynamoDB backup فعال کنید
5. [ ] WAF (Web Application Firewall) برای API تنظیم کنید
6. [ ] Domain SSL certificate دریافت کنید
7. [ ] Privacy policy و Terms of Service اضافه کنید

---

✅ پروژه شما آماده است!

برای سوالات: لطفاً issue در GitHub ایجاد کنید.
