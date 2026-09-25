> Superseded by [RELEASE.md](RELEASE.md), 2026-09-25. The rules below describe the old deployment. The canonical schema now restricts public access to availability and guest booking; Lambda enforces group/household access. Server-generated household codes and atomic rate limiting are implemented. Keep regression tests; never commit fixtures or credentials.

# 🔧 TODO: Security Fixes

## ❌ فوری - باید قبل از production انجام بشه

### 1. حذف Public Read از Residents
**وضعیت:** ❌ نشده  
**فایل:** `amplify/data/resource.ts`  
**خط:** ~36

**قبل:**
```typescript
.authorization((allow) => [
  allow.owner(),
  allow.group('ADMIN'),
  allow.publicApiKey().to(['read']), // ❌ این خط باید حذف بشه
])
```

**بعد:**
```typescript
.authorization((allow) => [
  allow.owner(),
  allow.group('ADMIN'),
])
```

**دلیل:** هرکسی میتونه لیست همه ساکنین با اطلاعات شخصیشون رو ببینه!

---

## ⚠️ مهم - برای بهبود امنیت

### 2. پاک کردن فایل‌های Test
**وضعیت:** ✅ انجام شد  
**فایل‌ها:** همه فایل‌های `test-*.js` و `*-resolver.js` حذف شدن

---

### 3. Rate Limiting روی API
**وضعیت:** ❌ نشده  
**محل:** AWS AppSync Console  
**اقدام لازم:**
- وارد AppSync Console بشو
- بخش Security → Rate limiting
- محدودیت: 1000 request per IP per hour

---

### 4. API Key Rotation
**وضعیت:** ⚠️ نیاز به برنامه‌ریزی  
**فعلی:** API key یک ساله (365 روز)  
**پیشنهاد:** هر 3 ماه یکبار rotate بشه

---

## ℹ️ اطلاعاتی - بعداً

### 5. CloudFront WAF
**وضعیت:** ❌ فعال نیست  
**هزینه:** ~$5/month  
**مزایا:** محافظت در برابر DDoS و bots

---

### 6. CORS Policy
**وضعیت:** ⚠️ چک نشده  
**باید چک بشه:** AppSync CORS فقط domain خودمون رو بپذیره

---

## 📋 چک لیست نهایی قبل از Production

- [ ] حذف `allow.publicApiKey().to(['read'])` از Resident
- [x] حذف فایل‌های test
- [ ] Rate limiting فعال
- [ ] CORS policy چک شده
- [ ] CloudFront WAF (اختیاری)
- [ ] API Key rotation plan
- [x] API Key معتبر است
- [x] داده fake حذف شده

---

**یادآوری:** قبل از هر commit این فایل رو چک کن!
