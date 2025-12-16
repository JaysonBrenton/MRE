---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Complete reference for all environment variables used in MRE application
purpose: Provides comprehensive documentation of all environment variables, including
         required vs optional, default values, validation rules, and environment-specific
         configurations. Essential for deployment, environment setup, and troubleshooting.
relatedFiles:
  - docker-compose.yml (Docker environment configuration)
  - README.md (basic setup instructions)
  - .env.docker (environment file template, if exists)
  - src/lib/prisma.ts (database connection)
  - src/lib/auth.ts (NextAuth configuration)
  - src/lib/ingestion-client.ts (ingestion service URL)
---

# Environment Variables Reference

**Last Updated:** 2025-01-27  
**Environment File:** `.env.docker` (for Docker Compose)

This document provides a complete reference for all environment variables used in the MRE application. All variables are configured via Docker Compose environment files or can be set directly in the environment.

---

## Table of Contents

1. [Variable Groups](#variable-groups)
2. [Next.js Application Variables](#nextjs-application-variables)
3. [Database Variables](#database-variables)
4. [Authentication Variables](#authentication-variables)
5. [Ingestion Service Variables](#ingestion-service-variables)
6. [Environment-Specific Values](#environment-specific-values)
7. [Security Considerations](#security-considerations)
8. [Example Configuration Files](#example-configuration-files)

---

## Variable Groups

Environment variables are organized into the following groups:

- **Database** - PostgreSQL connection and configuration
- **Application** - Next.js application configuration
- **Authentication** - NextAuth session and security
- **Ingestion Service** - Python ingestion service configuration
- **System** - Timezone and system-level settings

---

## Next.js Application Variables

### NODE_ENV

**Type:** String  
**Required:** Yes  
**Default:** `development`  
**Values:** `development` | `production` | `test`

Controls the Node.js environment mode. Affects:
- Logging levels
- Error handling
- Prisma query logging
- Development vs production optimizations

**Example:**
```bash
NODE_ENV=development
```

---

### PORT

**Type:** Number  
**Required:** No  
**Default:** `3001`  
**Environment:** Docker Compose

Port on which the Next.js application listens. Configured via Docker Compose port mapping.

**Example:**
```bash
PORT=3001
```

**Note:** In Docker Compose, this is mapped to `APP_PORT` environment variable for host port configuration.

---

### APP_PORT

**Type:** Number  
**Required:** No  
**Default:** `3001`  
**Environment:** Docker Compose (host)

Host port mapping for Docker Compose. Maps to container port 3001.

**Example:**
```bash
APP_PORT=3001
```

---

### APP_URL

**Type:** URL String  
**Required:** No  
**Default:** `http://localhost:3001`  
**Environment:** Docker Compose

Base URL of the application. Used for:
- Generating absolute URLs
- CORS configuration (if needed)
- OAuth redirects (if implemented)

**Example:**
```bash
APP_URL=http://localhost:3001
```

---

### HOST

**Type:** String  
**Required:** No  
**Default:** `0.0.0.0`  
**Environment:** Docker Compose

Host address to bind the Next.js server. Set to `0.0.0.0` to accept connections from any interface (required for Docker).

**Example:**
```bash
HOST=0.0.0.0
```

---

## Database Variables

### DATABASE_URL

**Type:** PostgreSQL Connection String  
**Required:** Yes  
**Default:** None  
**Format:** `postgresql://[user]:[password]@[host]:[port]/[database]?schema=public`

PostgreSQL database connection string used by Prisma. Contains:
- Database user
- Password
- Host (container name: `mre-postgres`)
- Port (5432)
- Database name
- Schema (public)

**Example:**
```bash
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
```

**Security:** Contains sensitive credentials. Never commit to version control.

**Components:**
- User: `pacetracer` (default)
- Password: `change-me` (default, MUST be changed in production)
- Host: `mre-postgres` (Docker container name)
- Port: `5432`
- Database: `pacetracer` (default)

**Note:** This variable is used by both the Next.js application and the Python ingestion service.

---

### POSTGRES_USER

**Type:** String  
**Required:** No  
**Default:** `pacetracer`  
**Environment:** Docker Compose (used to construct DATABASE_URL)

PostgreSQL database user name. Used in DATABASE_URL construction.

**Example:**
```bash
POSTGRES_USER=pacetracer
```

---

### POSTGRES_PASSWORD

**Type:** String  
**Required:** No  
**Default:** `change-me`  
**Environment:** Docker Compose (used to construct DATABASE_URL)

PostgreSQL database password. Used in DATABASE_URL construction.

**Example:**
```bash
POSTGRES_PASSWORD=change-me
```

**Security:** MUST be changed in production. Use a strong, randomly generated password.

---

### POSTGRES_DB

**Type:** String  
**Required:** No  
**Default:** `pacetracer`  
**Environment:** Docker Compose (used to construct DATABASE_URL)

PostgreSQL database name. Used in DATABASE_URL construction.

**Example:**
```bash
POSTGRES_DB=pacetracer
```

---

## Authentication Variables

### AUTH_SECRET

**Type:** String  
**Required:** Yes (for production)  
**Default:** `development-secret-change-in-production`  
**Environment:** Docker Compose

Secret key used by NextAuth for:
- JWT token signing
- Session encryption
- CSRF protection

**Example:**
```bash
AUTH_SECRET=development-secret-change-in-production
```

**Security:** MUST be changed in production. Use a strong, randomly generated secret (minimum 32 characters).

**Generation:**
```bash
openssl rand -base64 32
```

**Note:** NextAuth also checks `NEXTAUTH_SECRET` as a fallback (for compatibility).

---

### NEXTAUTH_SECRET

**Type:** String  
**Required:** No  
**Default:** Falls back to `AUTH_SECRET`  
**Environment:** Optional (NextAuth compatibility)

Alternative name for `AUTH_SECRET` for NextAuth compatibility. If not set, `AUTH_SECRET` is used.

**Example:**
```bash
NEXTAUTH_SECRET=your-secret-here
```

---

## Ingestion Service Variables

### INGESTION_SERVICE_URL

**Type:** URL String  
**Required:** No  
**Default:** `http://ingestion-service:8000`  
**Environment:** Next.js application (used by ingestion client)

Base URL of the Python ingestion service. Used by the Next.js application to communicate with the ingestion service.

**Example:**
```bash
INGESTION_SERVICE_URL=http://ingestion-service:8000
```

**Note:** In Docker Compose, this uses the service name `ingestion-service` and default port `8000`.

---

### INGESTION_PORT

**Type:** Number  
**Required:** No  
**Default:** `8000`  
**Environment:** Docker Compose (host)

Host port mapping for the Python ingestion service. Maps to container port 8000.

**Example:**
```bash
INGESTION_PORT=8000
```

---

### LOG_LEVEL

**Type:** String  
**Required:** No  
**Default:** `INFO`  
**Environment:** Python ingestion service

Logging level for the Python ingestion service.

**Values:** `DEBUG` | `INFO` | `WARNING` | `ERROR` | `CRITICAL`

**Example:**
```bash
LOG_LEVEL=INFO
```

---

### PYTHONUNBUFFERED

**Type:** String  
**Required:** No  
**Default:** `1`  
**Environment:** Python ingestion service

Disables Python output buffering for real-time log output in Docker.

**Example:**
```bash
PYTHONUNBUFFERED=1
```

---

## System Variables

### TZ

**Type:** Timezone String  
**Required:** No  
**Default:** `Australia/Sydney`  
**Environment:** Docker Compose (both services)

System timezone for both Next.js and Python services. Affects:
- Log timestamps
- Date/time parsing
- Scheduled tasks (if implemented)

**Example:**
```bash
TZ=Australia/Sydney
```

**Common Values:**
- `UTC` - Coordinated Universal Time
- `America/New_York` - Eastern Time
- `Europe/London` - British Time
- `Australia/Sydney` - Australian Eastern Time

---

## Environment-Specific Values

### Development

**File:** `.env.docker` (local development)

```bash
# Database
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
POSTGRES_USER=pacetracer
POSTGRES_PASSWORD=change-me
POSTGRES_DB=pacetracer

# Application
NODE_ENV=development
PORT=3001
APP_PORT=3001
APP_URL=http://localhost:3001
HOST=0.0.0.0

# Authentication
AUTH_SECRET=development-secret-change-in-production

# Ingestion Service
INGESTION_SERVICE_URL=http://ingestion-service:8000
INGESTION_PORT=8000
LOG_LEVEL=INFO
PYTHONUNBUFFERED=1

# System
TZ=Australia/Sydney
```

---

### Staging

**Placeholder:** Staging environment configuration

```bash
# Database
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/[database]?schema=public
POSTGRES_USER=[user]
POSTGRES_PASSWORD=[strong-password]
POSTGRES_DB=[database-name]

# Application
NODE_ENV=production
PORT=3001
APP_URL=https://staging.mre.example.com
HOST=0.0.0.0

# Authentication
AUTH_SECRET=[strong-random-secret]

# Ingestion Service
INGESTION_SERVICE_URL=http://ingestion-service:8000
LOG_LEVEL=INFO

# System
TZ=UTC
```

**Note:** Replace placeholders with actual staging values.

---

### Production

**Placeholder:** Production environment configuration

```bash
# Database
DATABASE_URL=postgresql://[user]:[strong-password]@[host]:5432/[database]?schema=public&sslmode=require
POSTGRES_USER=[user]
POSTGRES_PASSWORD=[strong-random-password]
POSTGRES_DB=[database-name]

# Application
NODE_ENV=production
PORT=3001
APP_URL=https://mre.example.com
HOST=0.0.0.0

# Authentication
AUTH_SECRET=[strong-random-secret-minimum-32-chars]

# Ingestion Service
INGESTION_SERVICE_URL=http://ingestion-service:8000
LOG_LEVEL=WARNING

# System
TZ=UTC
```

**Security Requirements:**
- All secrets MUST be strong and randomly generated
- Database connection MUST use SSL (`sslmode=require`)
- Passwords MUST be unique and not reused
- Secrets MUST be stored in secure secret management (not in code)

**Note:** Replace placeholders with actual production values. Use a secret management service (e.g., AWS Secrets Manager, HashiCorp Vault) in production.

---

## Security Considerations

### Sensitive Variables

The following variables contain sensitive information and MUST be protected:

1. **DATABASE_URL** - Contains database credentials
2. **POSTGRES_PASSWORD** - Database password
3. **AUTH_SECRET** - Session encryption key

### Security Best Practices

1. **Never commit secrets to version control**
   - Use `.env.docker` (already in `.gitignore`)
   - Use secret management services in production

2. **Use strong, random secrets**
   - Minimum 32 characters for `AUTH_SECRET`
   - Use `openssl rand -base64 32` to generate secrets

3. **Rotate secrets regularly**
   - Change passwords and secrets periodically
   - Rotate `AUTH_SECRET` when compromised

4. **Use different secrets per environment**
   - Development, staging, and production MUST use different secrets
   - Never reuse production secrets in development

5. **Limit access to secrets**
   - Only grant access to authorized personnel
   - Use least-privilege access principles

6. **Monitor secret usage**
   - Log access to sensitive variables (if possible)
   - Alert on unauthorized access attempts

### Validation Rules

**DATABASE_URL:**
- Must be a valid PostgreSQL connection string
- Must include user, password, host, port, and database
- Format: `postgresql://[user]:[password]@[host]:[port]/[database]?schema=public`

**AUTH_SECRET:**
- Minimum 32 characters (recommended)
- Should be randomly generated
- Must be unique per environment

**NODE_ENV:**
- Must be one of: `development`, `production`, `test`
- Affects application behavior and security

**Placeholder for future documentation:**
- Environment variable validation scripts
- Secret rotation procedures
- Security audit checklist

---

## Example Configuration Files

### Minimal Development Setup

**File:** `.env.docker` (minimum required variables)

```bash
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
AUTH_SECRET=development-secret-change-in-production
NODE_ENV=development
```

### Complete Development Setup

See [Development](#development) section above for complete example.

---

## Variable Reference Table

| Variable | Required | Default | Group | Security Sensitive |
|----------|----------|---------|-------|-------------------|
| `DATABASE_URL` | Yes | None | Database | Yes |
| `POSTGRES_USER` | No | `pacetracer` | Database | No |
| `POSTGRES_PASSWORD` | No | `change-me` | Database | Yes |
| `POSTGRES_DB` | No | `pacetracer` | Database | No |
| `NODE_ENV` | Yes | `development` | Application | No |
| `PORT` | No | `3001` | Application | No |
| `APP_PORT` | No | `3001` | Application | No |
| `APP_URL` | No | `http://localhost:3001` | Application | No |
| `HOST` | No | `0.0.0.0` | Application | No |
| `AUTH_SECRET` | Yes (prod) | `development-secret-change-in-production` | Authentication | Yes |
| `NEXTAUTH_SECRET` | No | Falls back to `AUTH_SECRET` | Authentication | Yes |
| `INGESTION_SERVICE_URL` | No | `http://ingestion-service:8000` | Ingestion | No |
| `INGESTION_PORT` | No | `8000` | Ingestion | No |
| `LOG_LEVEL` | No | `INFO` | Ingestion | No |
| `PYTHONUNBUFFERED` | No | `1` | Ingestion | No |
| `TZ` | No | `Australia/Sydney` | System | No |

---

## Related Documentation

- [Docker Review Report](../reviews/DOCKER_REVIEW_REPORT.md) - Docker setup and configuration
- [Deployment Guide](./deployment-guide.md) - Production deployment procedures
- [Security Overview](../security/security-overview.md) - Security best practices
- [README.md](../../README.md) - Basic setup instructions

---

**End of Environment Variables Reference**

