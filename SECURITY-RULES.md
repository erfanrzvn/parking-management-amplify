> Superseded by [RELEASE.md](RELEASE.md), 2026-09-25. The rules below describe the old deployment. The canonical schema now restricts public access to availability and guest booking; Lambda enforces group/household access. Server-generated household codes and atomic rate limiting are implemented. Keep regression tests; never commit fixtures or credentials.

# 🔐 Security & Authorization Rules

## ⚠️ قبل از هر تغییری این فایل رو بخون!

---

## 📍 فایل‌های کلیدی

1. **`amplify/data/resource.ts`** - Schema و Authorization Rules
2. **`src/lib/graphql.ts`** - GraphQL Client Configuration
3. **`amplify_outputs.json`** - API Configuration (شامل API Key)

---

## 🎯 قوانین کنونی (AS-IS)

### 1. ParkingConfig
```typescript
.authorization((allow) => [
  allow.group('ADMIN'),              // ✅ فقط Admin: create, update, delete
  allow.publicApiKey().to(['read']), // ✅ عموم: فقط خواندن
])
```
**✅ صحیح** - Admin کنترل کامل، عموم فقط میبینن

---

### 2. Resident (ساکنین)
```typescript
.authorization((allow) => [
  allow.owner(),                     // ✅ هر user خودش رو میبینه
  allow.group('ADMIN'),              // ✅ Admin همه رو میبینه
  allow.publicApiKey().to(['read']), // ⚠️ عموم میتونن لیست ببینن!
])
```

**⚠️ مشکل امنیتی:**
- `allow.publicApiKey().to(['read'])` = هرکسی بدون login میتونه لیست همه ساکنین رو ببینه!
- اطلاعات شخصی (نام، موبایل، پلاک، واحد) در معرض دید

**✅ راه حل پیشنهادی:**
```typescript
.authorization((allow) => [
  allow.owner(),
  allow.group('ADMIN'),
  // حذف: allow.publicApiKey().to(['read']),
])
```

---

### 3. Reservation (رزروها)
```typescript
.authorization((allow) => [
  allow.publicApiKey(),    // ✅ guest ها میتونن رزرو کنن
  allow.group('ADMIN'),    // ✅ Admin همه رو میبینه
])
```

**✅ صحیح** - guest ها باید بتونن بدون login رزرو کنن

---

## 🔑 API Configuration

### Current Setup:
```json
{
  "default_authorization_type": "API_KEY",
  "api_key": "da2-htffbvr7enbyhj676ekudimrmy"
}
```

**⚠️ مشکل:**
- API Key در frontend exposed است (هرکسی میتونه سورس ببینه)
- برای Reservation ضروری است (guest access)

**✅ راه حل:**
- Rate limiting در AWS AppSync
- CloudFront WAF
- IP whitelist (اگر ممکنه)

---

## 🚨 چک لیست قبل از Deploy

- [ ] فایل‌های test حذف شدن؟ (`test-*.js`, `*-resolver.js`)
- [ ] داده fake وجود نداره؟ (search: `fake`, `demo`, `test`)
- [ ] Authorization rules درست چک شدن؟
- [ ] API Key معتبر است؟
- [ ] `amplify_outputs.json` در `.gitignore` نیست (باید commit بشه)

---

## 📝 TODO: بهبودهای امنیتی

### فوری:
1. ❌ **حذف `allow.publicApiKey().to(['read'])` از Resident**
   - مردم نباید لیست ساکنین رو ببینن
   
### میان مدت:
2. ⚠️ Rate Limiting روی API
3. ⚠️ CORS Policy محدود به domain خودمون

### بلند مدت:
4. ⚠️ CloudFront WAF
5. ⚠️ API Key Rotation

---

## 🛑 قوانین مهم

### ✅ انجام بده:
- همیشه قبل از تغییر authorization این فایل رو بخون
- بعد از هر تغییر توی schema این فایل رو update کن
- فایل‌های test رو commit نکن
- API Key رو هیچوقت hardcode نکن توی کد

### ❌ انجام نده:
- **NEVER** حذف کردن `allow.publicApiKey()` از Reservation
- **NEVER** تغییر auth mode به userPool به طور کامل
- **NEVER** commit کردن credentials یا secrets
- **NEVER** فایل‌های test رو push کن

---

## 📞 در صورت مشکل

اگه authorization error گرفتی:
1. چک کن user logged in است؟
2. چک کن user در گروه ADMIN است؟ (برای عملیات admin)
3. چک کن API Key معتبر است؟
4. Console رو چک کن: `GraphQL Errors`

---

**آخرین بروزرسانی:** 2026-09-21  
**وضعیت:** ⚠️ نیاز به حذف public read از Resident
