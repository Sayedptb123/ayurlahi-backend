# Database GUI Setup Guide

## Recommended PostgreSQL GUI Tools for macOS

### Option 1: TablePlus (Recommended for macOS) ⭐

**Best for:** Modern UI, fast, native macOS app

**Installation:**
```bash
# Using Homebrew
brew install --cask tableplus

# Or download from: https://tableplus.com/
```

**Connection Settings:**
- **Host:** `localhost`
- **Port:** `5432`
- **User:** `postgres`
- **Password:** (your DB_PASSWORD from .env, or empty if none)
- **Database:** `ayurlahi`

**Pros:**
- Beautiful, modern interface
- Fast and lightweight
- Native macOS app
- Free for basic use (paid for advanced features)

---

### Option 2: DBeaver (Free & Open Source) ⭐

**Best for:** Free, feature-rich, cross-platform

**Installation:**
```bash
# Using Homebrew
brew install --cask dbeaver-community

# Or download from: https://dbeaver.io/download/
```

**Connection Settings:**
1. Open DBeaver → New Database Connection
2. Select **PostgreSQL**
3. Enter:
   - **Host:** `localhost`
   - **Port:** `5432`
   - **Database:** `ayurlahi`
   - **Username:** `postgres`
   - **Password:** (your DB_PASSWORD from .env)

**Pros:**
- Completely free and open source
- Very feature-rich
- Supports many database types
- Great for complex queries

---

### Option 3: pgAdmin 4 (Official PostgreSQL Tool)

**Best for:** Official tool, comprehensive features

**Installation:**
```bash
# Using Homebrew
brew install --cask pgadmin4

# Or download from: https://www.pgadmin.org/download/
```

**Connection Settings:**
1. Right-click "Servers" → Create → Server
2. General tab: Name = `Ayurlahi Local`
3. Connection tab:
   - **Host:** `localhost`
   - **Port:** `5432`
   - **Maintenance database:** `ayurlahi`
   - **Username:** `postgres`
   - **Password:** (your DB_PASSWORD from .env)

**Pros:**
- Official PostgreSQL tool
- Very comprehensive
- Free and open source
- Can be resource-intensive

---

### Option 4: Postico (macOS Native)

**Best for:** Simple, elegant macOS app

**Installation:**
```bash
# Using Homebrew
brew install --cask postico

# Or download from: https://eggerapps.at/postico/
```

**Connection Settings:**
- **Host:** `localhost`
- **Port:** `5432`
- **User:** `postgres`
- **Password:** (your DB_PASSWORD from .env)
- **Database:** `ayurlahi`

**Pros:**
- Beautiful, simple interface
- Native macOS app
- Great for quick database browsing
- Paid app (~$50, but has free trial)

---

## Quick Setup Script

Run this to install TablePlus (recommended):

```bash
brew install --cask tableplus
```

Then open TablePlus and create a new PostgreSQL connection with:
- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Database: `ayurlahi`

---

## Connection Details Summary

All tools will use these connection details:

```
Host:     localhost
Port:     5432
Database: ayurlahi
Username: postgres
Password: <check your .env file for DB_PASSWORD>
```

**To find your password:**
```bash
grep DB_PASSWORD .env
```

If `DB_PASSWORD` is empty in `.env`, you may not need a password (depends on your PostgreSQL setup).

---

## Recommendation

**For quick setup:** Use **TablePlus** - it's the easiest and most modern option for macOS.

**For free/open source:** Use **DBeaver** - it's completely free and very powerful.

**For official tool:** Use **pgAdmin 4** - it's the official PostgreSQL administration tool.





