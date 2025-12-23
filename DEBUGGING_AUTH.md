# Authentication Debugging Guide

## Debugging Steps

### 1. Check Backend Logs

After adding the debugging code, restart your backend server and try logging in. You should see detailed logs:

#### On Login:
```
[Auth Service] Login - JWT Secret check: { hasSecret: true, secretLength: X, ... }
[Auth Service] Login - Token generated: { tokenLength: 247, payload: {...}, ... }
```

#### On Protected Route Request:
```
[JWT Guard] Checking authentication: { url: '/api/analytics/dashboard', hasAuthHeader: true, ... }
[JWT Strategy] Validating token payload: { hasSub: true, payload: {...}, ... }
[JWT Guard] Authentication successful: { userId: '...', email: '...', role: 'admin' }
```

#### If Authentication Fails:
```
[JWT Guard] Authentication failed: { error: '...', info: '...', ... }
```

### 2. Common Issues to Check

#### Issue 1: JWT Secret Mismatch
**Symptoms:**
- Token is generated successfully
- Token is rejected immediately
- Error: "invalid signature" or "jwt malformed"

**Check:**
- Look for logs showing different secrets being used
- Verify `JWT_SECRET` environment variable is set
- Ensure the same secret is used in:
  - `auth.module.ts` (JwtModule.register)
  - `jwt.strategy.ts` (secretOrKey)
  - `auth.service.ts` (when signing tokens)

**Fix:**
```bash
# Set JWT_SECRET in .env file
JWT_SECRET=your-secret-key-here

# Restart backend server
npm run start:dev
```

#### Issue 2: Token Not Being Extracted
**Symptoms:**
- `hasAuthHeader: false` in logs
- Error: "No auth token"

**Check:**
- Frontend is sending `Authorization: Bearer <token>` header
- CORS allows `Authorization` header
- Backend is reading from correct header

**Fix:**
- Check CORS configuration in `main.ts`
- Verify frontend is sending header correctly

#### Issue 3: Token Expired Immediately
**Symptoms:**
- Token generated successfully
- Token rejected with "jwt expired"
- `exp` claim is in the past

**Check:**
- Server clock is synchronized
- Token expiration time is reasonable (7d in config)
- No time drift between frontend/backend

#### Issue 4: Payload Mismatch
**Symptoms:**
- Token verified but `validate()` fails
- Missing `sub`, `email`, or `role` in payload

**Check:**
- Payload structure matches `JwtPayload` interface
- All required fields are present

### 3. Environment Variables

Create/check `.env` file in backend root:

```env
JWT_SECRET=your-super-secret-key-change-this-in-production
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### 4. Testing Steps

1. **Start Backend:**
   ```bash
   cd ayurlahi-backend
   npm run start:dev
   ```

2. **Check Initialization Logs:**
   Look for:
   ```
   [JWT Strategy] Initializing with secret: { hasSecret: true, ... }
   ```

3. **Login:**
   - Use frontend to login
   - Check backend logs for token generation

4. **Make Protected Request:**
   - Frontend makes request to `/api/analytics/dashboard`
   - Check backend logs for authentication flow

5. **Compare Secrets:**
   - Login secret should match validation secret
   - Both should show same `secretPreview` in logs

### 5. What to Look For in Logs

#### ✅ Success Pattern:
```
[Auth Service] Login - Token generated: { tokenLength: 247, ... }
[JWT Guard] Checking authentication: { hasAuthHeader: true, ... }
[JWT Strategy] Validating token payload: { hasSub: true, ... }
[JWT Guard] Authentication successful: { userId: '...', ... }
```

#### ❌ Failure Pattern:
```
[Auth Service] Login - Token generated: { ... }
[JWT Guard] Checking authentication: { hasAuthHeader: true, ... }
[JWT Guard] Authentication failed: { error: 'invalid signature', ... }
```

### 6. Quick Fixes

#### If JWT Secret is Missing:
```typescript
// In auth.module.ts and jwt.strategy.ts
// Both should use the same secret
secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
```

#### If CORS is Blocking:
```typescript
// In main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'], // Make sure Authorization is here
});
```

#### If Token Format is Wrong:
- Frontend sends: `Authorization: Bearer <token>`
- Backend extracts: `ExtractJwt.fromAuthHeaderAsBearerToken()`
- These should match

### 7. Debugging Checklist

- [ ] JWT_SECRET is set in backend .env file
- [ ] Backend server is restarted after adding debug logs
- [ ] Frontend is sending `Authorization: Bearer <token>` header
- [ ] CORS allows Authorization header
- [ ] Same JWT secret used for signing and verification
- [ ] Token is not expired (check `exp` claim)
- [ ] Backend logs show token being received
- [ ] Backend logs show token validation attempt
- [ ] Error messages in logs are clear

### 8. Next Steps

After checking logs:
1. Identify the exact error message
2. Check which step fails (token generation, extraction, or validation)
3. Compare secrets used in different places
4. Verify token format matches expectations
5. Check CORS and header configuration



