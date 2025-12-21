# Download Database GUI Apps from Chrome

## Option 1: Web-Based (No Download Required) 🌐

### 1. **Adminer** (Web-based, Free)
**Best for:** Quick access without installation

**How to use:**
1. Download Adminer PHP file: https://www.adminer.org/
2. Or use online version: https://www.adminer.org/en/editor/
3. Enter your PostgreSQL connection details
4. Access directly from Chrome

**Connection:**
- System: PostgreSQL
- Server: `localhost`
- Username: `postgres`
- Password: (from your .env)
- Database: `ayurlahi`

---

### 2. **pgAdmin 4 Web** (Official, Free)
**Best for:** Full-featured web interface

**Installation:**
```bash
# Install pgAdmin 4 (includes web interface)
brew install --cask pgadmin4
```

**Access:**
- After installation, open: `http://localhost:5050`
- Login with your pgAdmin credentials
- Add PostgreSQL server connection

---

### 3. **DBeaver Cloud** (Web-based)
**Best for:** Cloud access

**Access:**
- Visit: https://dbeaver.io/cloud/
- Sign up for free account
- Connect to your local PostgreSQL (requires SSH tunnel or public IP)

---

## Option 2: Download Desktop Apps (Through Browser)

### 1. **TablePlus** (Recommended) ⭐
**Download:** https://tableplus.com/download

**Steps:**
1. Open Chrome
2. Go to: https://tableplus.com/download
3. Click "Download for macOS"
4. Install the .dmg file
5. Open TablePlus and connect to PostgreSQL

**Connection:**
- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Database: `ayurlahi`

---

### 2. **DBeaver Community** (Free)
**Download:** https://dbeaver.io/download/

**Steps:**
1. Open Chrome
2. Go to: https://dbeaver.io/download/
3. Click "DBeaver Community Edition"
4. Download macOS installer (.dmg)
5. Install and open DBeaver

**Connection:**
1. New Database Connection → PostgreSQL
2. Host: `localhost`, Port: `5432`
3. Database: `ayurlahi`, User: `postgres`

---

### 3. **pgAdmin 4** (Official)
**Download:** https://www.pgadmin.org/download/

**Steps:**
1. Open Chrome
2. Go to: https://www.pgadmin.org/download/
3. Click "macOS" tab
4. Download installer
5. Install and open pgAdmin

---

### 4. **Postico** (macOS Native)
**Download:** https://eggerapps.at/postico/

**Steps:**
1. Open Chrome
2. Go to: https://eggerapps.at/postico/
3. Click "Download Postico"
4. Install .dmg file
5. Open and connect

**Note:** Postico is paid (~$50) but has free trial

---

### 5. **Beekeeper Studio** (Free, Open Source)
**Download:** https://www.beekeeperstudio.io/get

**Steps:**
1. Open Chrome
2. Go to: https://www.beekeeperstudio.io/get
3. Download macOS version
4. Install and connect

---

## Quick Download Links (Copy-Paste in Chrome)

### Free Options:
- **TablePlus:** https://tableplus.com/download
- **DBeaver:** https://dbeaver.io/download/
- **pgAdmin 4:** https://www.pgadmin.org/download/
- **Beekeeper Studio:** https://www.beekeeperstudio.io/get

### Web-Based (No Download):
- **Adminer Online:** https://www.adminer.org/en/editor/

---

## Recommended: TablePlus (Easiest)

**Why TablePlus:**
- ✅ Beautiful, modern interface
- ✅ Fast and lightweight
- ✅ Native macOS app
- ✅ Easy to use
- ✅ Free for basic use

**Download Steps:**
1. Open Chrome
2. Visit: **https://tableplus.com/download**
3. Click "Download for macOS"
4. Open downloaded .dmg file
5. Drag TablePlus to Applications
6. Open TablePlus
7. Click "Create a new connection"
8. Select "PostgreSQL"
9. Enter:
   - Name: `Ayurlahi Local`
   - Host: `localhost`
   - Port: `5432`
   - User: `postgres`
   - Password: (from your .env file)
   - Database: `ayurlahi`
10. Click "Test" then "Connect"

---

## Connection Details (All Apps)

All apps will need these details:

```
Host:     localhost
Port:     5432
Database: ayurlahi
Username: postgres
Password: <check your .env file>
```

**To find your password:**
```bash
grep DB_PASSWORD .env
```

If `DB_PASSWORD` is empty, you may not need a password.

---

## Web-Based Alternative (No Download)

If you don't want to download anything, use **Adminer**:

1. Visit: https://www.adminer.org/en/editor/
2. Select: **PostgreSQL**
3. Enter:
   - Server: `localhost:5432`
   - Username: `postgres`
   - Password: (from .env)
   - Database: `ayurlahi`
4. Click "Login"

**Note:** This requires your PostgreSQL to accept connections from the web (may need configuration).

---

## My Recommendation

**For desktop app:** Download **TablePlus** from https://tableplus.com/download
- Easiest to use
- Best macOS experience
- Free for basic use

**For web-based:** Use **Adminer** at https://www.adminer.org/en/editor/
- No installation needed
- Works in Chrome
- Free and simple





