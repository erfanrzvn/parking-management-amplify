# نتیجه تست API

## ⚠️ نکته مهم

برای تست کامل APIها، نیاز به راه‌اندازی backend در AWS هست که شامل:

1. **AWS Amplify Sandbox** - برای development
2. **Cognito User Pool** - برای authentication
3. **DynamoDB Tables** - برای ذخیره data
4. **AppSync API** - برای GraphQL endpoint

## راه‌های تست

### روش 1: Local Development (توصیه می‌شود)

```bash
# Terminal 1: Backend
npx @aws-amplify/backend-cli@latest sandbox

# Terminal 2: Frontend
npm run dev
```

منتظر بمانید تا backend deploy شود (3-5 دقیقه) و فایل `amplify_outputs.json` ساخته شود.

### روش 2: Direct AWS Testing

بعد از deploy شدن backend، می‌توانید مستقیماً با AWS CLI تست کنید:

#### 1. لیست کردن DynamoDB Tables

```bash
aws dynamodb list-tables --region ca-central-1
```

#### 2. وارد کردن test data

```bash
# Sample ParkingConfig
aws dynamodb put-item \
  --table-name YOUR_TABLE_NAME \
  --item '{
    "id": {"S": "config"},
    "totalSpots": {"N": "20"},
    "updatedAt": {"S": "2026-08-01T06:00:00.000Z"}
  }' \
  --region ca-central-1
```

#### 3. Query data

```bash
aws dynamodb scan \
  --table-name YOUR_TABLE_NAME \
  --region ca-central-1
```

### روش 3: GraphQL Testing (بعد از deploy)

```bash
# Get AppSync endpoint
aws appsync list-graphql-apis --region ca-central-1

# Test query با curl
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"query":"query { listParkingConfigs { items { id totalSpots } } }"}' \
  YOUR_APPSYNC_ENDPOINT
```

## چرا نمی‌تونم الان تست کنم؟

Amplify Gen 2 نیاز به این مراحل داره:

1. ✅ **Code آماده است** - همه فایل‌ها نوشته شدند
2. ⏳ **Deploy نشده** - باید backend روی AWS بالا بیاد
3. ⏳ **Resources ساخته نشن** - DynamoDB, Cognito, AppSync

بعد از `npx ampx sandbox` یا `npx ampx deploy`:
- CloudFormation stack ساخته می‌شه
- AWS resources provision میشن
- API endpoint و credentials داده میشه

## مراحل برای تست کامل

### مرحله 1: Deploy Backend

```bash
npm install
npx @aws-amplify/backend-cli@latest sandbox
```

منتظر بمانید تا این پیام ظاهر شود:
```
✨ Deployed successfully!
```

### مرحله 2: بررسی Resources

```bash
# Check CloudFormation
aws cloudformation list-stacks --region ca-central-1

# Check Cognito
aws cognito-idp list-user-pools --max-results 10 --region ca-central-1

# Check DynamoDB
aws dynamodb list-tables --region ca-central-1

# Check AppSync
aws appsync list-graphql-apis --region ca-central-1
```

### مرحله 3: ساخت Admin User

```bash
# Get User Pool ID
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region ca-central-1 --query 'UserPools[0].Id' --output text)

# Create admin
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@parking.com \
  --user-attributes Name=email,Value=admin@parking.com Name=email_verified,Value=true \
  --temporary-password Admin123! \
  --region ca-central-1

# Add to ADMIN group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@parking.com \
  --group-name ADMIN \
  --region ca-central-1
```

### مرحله 4: تست Frontend

```bash
npm run dev
```

برو به http://localhost:3000 و:
1. تب مدیر → login با admin@parking.com
2. Set total spots به 20
3. تب ساکنین → ثبت‌نام یک ساکن
4. تب مهمان → رزرو با کد ساکن

## Mock Test (بدون AWS)

اگر می‌خواهید بدون AWS تست کنید، باید mock backend بسازید:

```javascript
// mock-api.js
const mockData = {
  parkingConfig: { id: 'config', totalSpots: 20 },
  residents: [],
  reservations: []
};

// Mock API endpoints
const mockAPI = {
  createReservation: (data) => {
    const activeCount = mockData.reservations.filter(
      r => new Date(r.endTime) > new Date()
    ).length;
    
    if (activeCount >= mockData.parkingConfig.totalSpots) {
      return { error: 'Parking full' };
    }
    
    mockData.reservations.push(data);
    return { success: true, data };
  },
  
  checkAvailability: () => {
    const activeCount = mockData.reservations.filter(
      r => new Date(r.endTime) > new Date()
    ).length;
    
    return {
      available: activeCount < mockData.parkingConfig.totalSpots,
      availableSpots: mockData.parkingConfig.totalSpots - activeCount,
      totalSpots: mockData.parkingConfig.totalSpots
    };
  }
};
```

## خلاصه

✅ **کد آماده است**
✅ **ساختار درست است**
✅ **مستندات کامل است**

⏳ **برای تست نیاز به:**
1. Deploy کردن backend روی AWS
2. ساخت admin user در Cognito
3. اجرای frontend

## دستور نهایی

برای تست کامل سیستم:

```bash
# در یک ترمینال
npm install
npx @aws-amplify/backend-cli@latest sandbox

# منتظر بمان تا deploy شود (3-5 دقیقه)

# در ترمینال دیگر
npm run dev

# برو به http://localhost:3000
```

---

**پروژه آماده است! فقط نیاز به deploy دارد.** 🚀
