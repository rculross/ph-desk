# Testing Authentication System - Quick Guide

## Prerequisites

1. Have Planhat credentials ready (production or demo account)
2. Terminal open in `/Users/robculross/Desktop/prog/ph-desk`
3. Dependencies installed (`npm install` if not done)

## Test Scenario 1: Fresh Login

**Goal**: Verify login flow works from scratch

```bash
# Clear any existing auth data
rm -rf ~/Library/Application\ Support/ph-desk-storage

# Start app in dev mode
npm run dev
```

**Expected Behavior**:
1. App shows login prompt screen
2. Environment selector shows "Production" and "Demo"
3. Click "Login to Planhat"
4. New window opens with Planhat login page
5. Enter credentials
6. Login window automatically closes
7. Main app appears with all features

**Console Output to Verify**:
```
[Auth] Initializing authentication service...
[Auth] No stored authentication found
[Main] Opening login window for production
[Auth] Opening login window: https://app.planhat.com/login
[Auth] Navigation: https://app.planhat.com/<tenant>/...
[Auth] Login successful, capturing session...
[Auth] Captured X cookies from Planhat domains
```

## Test Scenario 2: Session Persistence

**Goal**: Verify cookies are saved and restored

```bash
# After successful login from Scenario 1
# Close the app (Cmd+Q or close window)

# Reopen app
npm run dev
```

**Expected Behavior**:
1. Brief "Checking authentication..." screen
2. Immediately shows main app (no login prompt)
3. All features work normally

**Console Output to Verify**:
```
[Main] Restoring saved authentication session...
[Auth] Restored cookie: <name> for <domain>
[Main] Authentication session restored successfully
[Auth] Found stored authentication data
[Auth] Session restored successfully
```

## Test Scenario 3: API Integration

**Goal**: Verify API requests use session cookies

**Steps**:
1. Login successfully
2. Navigate to any data export feature
3. Try to fetch data (e.g., Issues, Companies)

**Expected Behavior**:
- API requests succeed
- Data loads without errors
- No 401/authentication errors

**Console Output to Verify**:
```
[HTTP] API request completed: GET /companies - 200
[HTTP] API request completed: GET /issues - 200
```

## Test Scenario 4: Demo Environment

**Goal**: Verify demo environment login works

```bash
# Clear auth data
rm -rf ~/Library/Application\ Support/ph-desk-storage

# Start app
npm run dev
```

**Steps**:
1. On login screen, click "Demo" button
2. Click "Login to Planhat"
3. Should open `https://app.planhatdemo.com/login`
4. Login with demo credentials

**Expected Behavior**:
- Login window opens to planhatdemo.com
- After login, captures demo cookies
- App works with demo environment

## Test Scenario 5: Error Handling

**Goal**: Verify error handling is graceful

### Test 5a: Cancel Login
1. Click "Login to Planhat"
2. Close login window without entering credentials

**Expected**: Error message "Login cancelled. Please try again."

### Test 5b: Network Error
1. Disable internet connection
2. Click "Login to Planhat"

**Expected**: Error message about connection failure

## Test Scenario 6: Session Expiration

**Goal**: Verify 401 handling works (requires long test)

**Note**: This test requires waiting for Planhat session to expire (hours)

**Steps**:
1. Login successfully
2. Wait for session to expire (or manually clear cookies in Planhat)
3. Try to fetch data

**Expected Behavior**:
- API request returns 401
- Console shows: `[HTTP] Received 401 Unauthorized - session may have expired`
- App clears auth state
- Returns to login prompt

## Debugging

### Check Stored Auth Data

```bash
# Mac/Linux
cat ~/Library/Application\ Support/ph-desk-storage/config.json
```

Should show encrypted auth data if logged in.

### Check Console Logs

All auth operations log to console with `[Auth]` prefix:
- `[Auth]` - Auth service operations
- `[Main]` - Main process auth operations
- `[HTTP]` - API client operations

### Common Issues

**Issue**: Login window doesn't open
- **Check**: Console for errors
- **Fix**: Ensure main window is created first

**Issue**: Cookies not persisted
- **Check**: electron-store permissions
- **Fix**: Check write permissions on Application Support folder

**Issue**: API requests fail with 401
- **Check**: Cookies were captured correctly
- **Fix**: Verify cookies in console log during login

**Issue**: App shows login prompt after restart
- **Check**: Auth data in storage
- **Fix**: Re-login, check console for storage errors

## Expected Authentication Flow Diagram

```
┌─────────────┐
│  App Start  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Check for saved │
│   auth data     │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Found?  │
    └────┬────┘
         │
    ┌────┴──────┐
    │           │
    ▼           ▼
┌───────┐   ┌────────────┐
│  Yes  │   │     No     │
└───┬───┘   └─────┬──────┘
    │             │
    ▼             ▼
┌────────────┐ ┌──────────────┐
│  Restore   │ │ Show Login   │
│  Cookies   │ │    Prompt    │
└─────┬──────┘ └──────┬───────┘
      │                │
      ▼                ▼
┌─────────────┐  ┌──────────────┐
│   Verify    │  │  User Clicks │
│   Valid?    │  │    Login     │
└──────┬──────┘  └──────┬───────┘
       │                │
   ┌───▼───┐            ▼
   │Valid? │      ┌──────────────┐
   └───┬───┘      │ Open Login   │
       │          │    Window    │
   ┌───┴────┐     └──────┬───────┘
   │        │            │
   ▼        ▼            ▼
┌──────┐ ┌────────┐ ┌──────────────┐
│ Yes  │ │   No   │ │ User Enters  │
└───┬──┘ └────┬───┘ │  Credentials │
    │         │     └──────┬───────┘
    │         │            │
    │         ▼            ▼
    │    ┌────────────┐ ┌──────────────┐
    │    │   Clear    │ │   Success?   │
    │    │   & Show   │ └──────┬───────┘
    │    │   Login    │        │
    │    └────────────┘    ┌───▼───┐
    │                      │       │
    │                      ▼       ▼
    │                   ┌──────┐ ┌────────┐
    │                   │ Yes  │ │   No   │
    │                   └───┬──┘ └────┬───┘
    │                       │         │
    │                       ▼         ▼
    │                  ┌──────────┐ ┌──────────┐
    │                  │ Capture  │ │  Show    │
    │                  │ Cookies  │ │  Error   │
    │                  └─────┬────┘ └──────────┘
    │                        │
    └────────────────────────┘
                 │
                 ▼
          ┌─────────────┐
          │  Show Main  │
          │     App     │
          └─────────────┘
```

## Success Criteria Checklist

- [ ] Login prompt shows on first run
- [ ] Can select Production environment
- [ ] Can select Demo environment
- [ ] Login window opens successfully
- [ ] Credentials accepted and window closes
- [ ] Main app loads after login
- [ ] Cookies saved to storage
- [ ] App remembers login on restart
- [ ] API requests work with cookies
- [ ] 401 errors trigger re-login
- [ ] Cancel login shows error message
- [ ] All console logs show expected output

## Next Steps After Testing

If all tests pass:
1. Document any issues found
2. Proceed to Phase 4 (Desktop Features)
3. Add logout button to UI
4. Implement session status display
5. Package app for distribution

If tests fail:
1. Check console logs for errors
2. Verify electron-store is working
3. Check IPC communication
4. Test individual components
5. Report specific error messages
