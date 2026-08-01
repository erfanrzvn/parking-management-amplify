# 🎉 Deployment موفق - سیستم مدیریت پارکینگ

## ✅ سرویس‌های Deploy شده

### 1. **AWS Cognito (Authentication)**
- **User Pool ID:** `ca-central-1_dBeo5yZXq`
- **Client ID:** `55mcsbc9dam8ncms93jrfakd0b`
- **Identity Pool:** `ca-central-1:f4298cac-896a-4ac6-924a-7fa27db41441`
- **Region:** `ca-central-1`
- **User Groups:** ADMIN, RESIDENT

### 2. **AWS AppSync (GraphQL API)**
- **API URL:** `https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql`
- **API Key:** `da2-5rll2d4qm5dlxl5szpdw3ra3ra`
- **API ID:** `p6u7zkzkhrbuter3jhkvujkhpa`
- **Authorization Types:**
  - API Key (برای Guest access)
  - Cognito User Pools (برای Admin و Resident)
  - AWS IAM

### 3. **DynamoDB Tables**
- **ParkingConfig** - تنظیمات کلی (تعداد جای پارک)
- **Resident** - اطلاعات ساکنین
- **Reservation** - رزروهای مهمان‌ها

### 4. **AWS Lambda Function**
- **Function Name:** `parking-checkAvailability`
- **Purpose:** بررسی وضعیت خالی بودن پارکینگ و محاسبه زمان بعدی

---

## 🔑 اطلاعات دسترسی

### Frontend Configuration
فایل `amplify_outputs.json` با اطلاعات زیر آماده است:

```json
{
  "auth": {
    "user_pool_id": "ca-central-1_dBeo5yZXq",
    "user_pool_client_id": "55mcsbc9dam8ncms93jrfakd0b"
  },
  "data": {
    "url": "https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql",
    "api_key": "da2-5rll2d4qm5dlxl5szpdw3ra3ra"
  }
}
```

---

## 🧪 تست API

### مثال: ایجاد تنظیمات پارکینگ (Admin)
```bash
curl -X POST \
  https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql \
  -H 'x-api-key: da2-5rll2d4qm5dlxl5szpdw3ra3ra' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "mutation { createParkingConfig(input: {totalSpots: 20, updatedBy: \"admin\"}) { id totalSpots updatedBy createdAt } }"
  }'
```

**نتیجه:**
```json
{
  "data": {
    "createParkingConfig": {
      "id": "ff696dfb-7955-41fa-b486-e003ef12f251",
      "totalSpots": 20,
      "updatedBy": "admin",
      "createdAt": "2026-08-01T11:17:17.505Z"
    }
  }
}
```

### مثال: دریافت لیست تنظیمات
```bash
curl -X POST \
  https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql \
  -H 'x-api-key: da2-5rll2d4qm5dlxl5szpdw3ra3ra' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "query { listParkingConfigs { id totalSpots updatedBy createdAt } }"
  }'
```

---

## 📋 GraphQL Queries و Mutations

### Queries
- `getParkingConfig(id: ID!)` - دریافت یک تنظیم
- `listParkingConfigs` - لیست تمام تنظیمات
- `getResident(id: ID!)` - دریافت اطلاعات یک ساکن
- `listResidents` - لیست تمام ساکنین
- `getReservation(id: ID!)` - دریافت یک رزرو
- `listReservations` - لیست تمام رزروها
- `checkAvailability` - بررسی در دسترس بودن پارکینگ

### Mutations
- `createParkingConfig(input: CreateParkingConfigInput!)` - ایجاد تنظیمات (Admin)
- `updateParkingConfig(input: UpdateParkingConfigInput!)` - ویرایش تنظیمات (Admin)
- `createResident(input: CreateResidentInput!)` - ایجاد ساکن (Admin)
- `createReservation(input: CreateReservationInput!)` - ایجاد رزرو (Guest)
- `updateReservation(input: UpdateReservationInput!)` - ویرایش رزرو

---

## 🚀 راه‌اندازی Frontend

1. **نصب dependencies:**
```bash
npm install
```

2. **اجرای development server:**
```bash
npm run dev
```

3. **دسترسی به برنامه:**
```
http://localhost:5173
```

---

## 👥 ایجاد کاربران

### ایجاد Admin User
```bash
aws cognito-idp admin-create-user \
  --user-pool-id ca-central-1_dBeo5yZXq \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --temporary-password Admin@123456 \
  --region ca-central-1

# افزودن به گروه ADMIN
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_dBeo5yZXq \
  --username admin@example.com \
  --group-name ADMIN \
  --region ca-central-1
```

### ایجاد Resident User
```bash
aws cognito-idp admin-create-user \
  --user-pool-id ca-central-1_dBeo5yZXq \
  --username resident@example.com \
  --user-attributes \
    Name=email,Value=resident@example.com \
    Name=custom:floor,Value="Floor-3" \
    Name=custom:plate,Value="ABC123" \
    Name=custom:residentCode,Value="RES12345" \
  --temporary-password Resident@123456 \
  --region ca-central-1

# افزودن به گروه RESIDENT
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_dBeo5yZXq \
  --username resident@example.com \
  --group-name RESIDENT \
  --region ca-central-1
```

---

## 🏗️ معماری سیستم

```
┌─────────────────┐
│  React Frontend │
│   (Vite + TS)   │
└────────┬────────┘
         │
         ↓
┌────────────────────────┐
│   AWS Amplify Config   │
│  (amplify_outputs.json)│
└────────┬───────────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌──────────────┐
│ Cognito │ │ AppSync API  │
│  Auth   │ │  (GraphQL)   │
└─────────┘ └──────┬───────┘
                   │
         ┌─────────┼─────────┐
         │         │         │
         ↓         ↓         ↓
    ┌────────┐ ┌──────┐ ┌────────┐
    │ Lambda │ │ DDB  │ │  DDB   │
    │  Func  │ │ Res  │ │ Config │
    └────────┘ └──────┘ └────────┘
```

---

## 📝 CloudFormation Stack

**Stack Name:** `parking-management-appsync`
**Status:** ✅ CREATE_COMPLETE
**Template:** `cloudformation/appsync-dynamodb.yaml`

### مشاهده resources:
```bash
aws cloudformation describe-stack-resources \
  --stack-name parking-management-appsync \
  --region ca-central-1
```

### مشاهده outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name parking-management-appsync \
  --region ca-central-1 \
  --query 'Stacks[0].Outputs'
```

---

## 🐛 مشکل Amplify Gen 2 که حل شد

**مشکل اصلی:**
Amplify Gen 2 CLI یک property به نام `Region` به `AWS::AppSync::GraphQLApi` resource اضافه می‌کرد که CloudFormation این property را support نمی‌کند:

```
Error: Property validation failure: [Encountered unsupported properties in {/}: [Region]]
```

**راه‌حل:**
CloudFormation template سفارشی نوشتیم که **بدون property Region** تمام resources لازم را می‌سازد:
- ✅ AppSync GraphQL API
- ✅ DynamoDB Tables (با Global Secondary Indexes)
- ✅ AppSync Resolvers (با APPSYNC_JS runtime)
- ✅ Lambda Function برای checkAvailability
- ✅ IAM Roles و Permissions
- ✅ API Key برای guest access

---

## 📊 وضعیت نهایی

| سرویس | وضعیت | جزئیات |
|------|--------|---------|
| Cognito Auth | ✅ موفق | User Pool + Groups + Identity Pool |
| AppSync API | ✅ موفق | GraphQL با 3 authorization types |
| DynamoDB | ✅ موفق | 3 tables با indexes |
| Lambda | ✅ موفق | checkAvailability function |
| Frontend | ✅ آماده | React + Vite + TypeScript |
| Git Repo | ✅ کامل | 9 commits با تمام تغییرات |

---

## 🔗 لینک‌های مفید

- **AWS Console - Cognito:** https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_dBeo5yZXq
- **AWS Console - AppSync:** https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/p6u7zkzkhrbuter3jhkvujkhpa/v1/home
- **AWS Console - DynamoDB:** https://ca-central-1.console.aws.amazon.com/dynamodbv2/home?region=ca-central-1#tables
- **AWS Console - CloudFormation:** https://ca-central-1.console.aws.amazon.com/cloudformation/home?region=ca-central-1#/stacks

---

## 📅 زمان Deploy

**تاریخ:** 1 اوت 2026  
**ساعت:** 14:17 (UTC+3:30)  
**مدت زمان کل:** ~2 ساعت (شامل troubleshooting Amplify bug)

---

## ✨ نکات مهم

1. **API Key** برای guest access یک سال اعتبار دارد
2. **Cognito password policy** شامل حداقل 8 کاراکتر + uppercase + lowercase + number + symbol
3. **DynamoDB** در حالت PAY_PER_REQUEST است (بدون هزینه ثابت)
4. **Lambda function** به صورت خودکار next available time را محاسبه می‌کند
5. همه **resolvers** با JavaScript runtime جدید AppSync نوشته شدند

---

تمام سرویس‌ها deploy شده و کار می‌کنند! 🚀
