---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Deployment and DevOps runbook for MRE application
purpose:
  Provides comprehensive deployment procedures, including pre-deployment
  checklists, deployment steps, database migrations, rollback procedures, and
  health checks. Ensures reliable deployments and clear procedures for
  operations team.
relatedFiles:
  - docker-compose.yml (container configuration)
  - Dockerfile (build configuration)
  - docs/reviews/DOCKER_REVIEW_REPORT.md (Docker review)
  - README.md (basic Docker setup)
  - prisma/migrations/ (migration files)
---

# Deployment and DevOps Runbook

**Last Updated:** 2025-01-27  
**Scope:** Production deployment procedures

This document provides comprehensive deployment procedures for the MRE
application, including pre-deployment checklists, deployment steps, database
migrations, rollback procedures, and health checks.

---

## Table of Contents

1. [Deployment Architecture](#deployment-architecture)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Procedures](#deployment-procedures)
4. [Database Migration Procedures](#database-migration-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Health Check Procedures](#health-check-procedures)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring and Alerting Setup](#monitoring-and-alerting-setup)
9. [Disaster Recovery Procedures](#disaster-recovery-procedures)

---

## Deployment Architecture

### Container Architecture

**Services:**

- `mre-app` - Next.js application (port 3001)
- `mre-liverc-ingestion-service` - Python ingestion service (port 8000)
- `mre-postgres` - PostgreSQL database (port 5432)

**Network:**

- Docker network: `my-race-engineer_mre-network`
- Bridge network for service communication

### Deployment Environments

**Development:**

- Local Docker Compose
- Hot reload enabled
- Source code mounted as volumes

**Staging:**

- **Placeholder:** Staging environment configuration

**Production:**

- **Placeholder:** Production environment configuration

---

## Pre-Deployment Checklist

### Code Quality Checks

- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review completed and approved
- [ ] Linting and type checking passed
- [ ] No security vulnerabilities in dependencies
- [ ] Documentation updated

### Database Checks

- [ ] Database migrations reviewed
- [ ] Migration scripts tested in staging
- [ ] Backup of production database created
- [ ] Rollback plan documented

### Configuration Checks

- [ ] Environment variables reviewed
- [ ] Secrets updated and secure
- [ ] Database connection strings verified
- [ ] API keys and tokens configured

### Infrastructure Checks

- [ ] Docker images built and tested
- [ ] Container health checks configured
- [ ] Network configuration verified
- [ ] Resource limits configured

---

## Deployment Procedures

### Development Deployment

**Using Docker Compose:**

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# Verify services
docker compose ps

# View logs
docker compose logs -f
```

### Staging Deployment

**Placeholder:** Staging deployment procedures will be documented

**Recommended Steps:**

1. Build Docker images
2. Push images to container registry
3. Deploy to staging environment
4. Run database migrations
5. Verify health checks
6. Run smoke tests

### Production Deployment

**Placeholder:** Production deployment procedures will be documented

**Recommended Steps:**

1. **Pre-deployment**
   - Create database backup
   - Review deployment plan
   - Notify team

2. **Deployment**
   - Build production Docker images
   - Push images to registry
   - Deploy to production (blue-green or rolling)
   - Run database migrations
   - Verify health checks

3. **Post-deployment**
   - Run smoke tests
   - Monitor logs and metrics
   - Verify critical functionality
   - Notify team of completion

---

## Database Migration Procedures

### Migration Workflow

**Development:**

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migration
npx prisma migrate deploy
```

**Production:**

```bash
# Review migration SQL
cat prisma/migrations/[timestamp]_migration_name/migration.sql

# Apply migration (inside container)
docker exec -it mre-app npx prisma migrate deploy

# Or apply locally (if database accessible)
npx prisma migrate deploy
```

### Migration Best Practices

1. **Test migrations in staging first**
2. **Review migration SQL before production**
3. **Backup database before migration**
4. **Run migrations during low-traffic periods**
5. **Monitor migration progress**
6. **Verify data integrity after migration**

### Migration Rollback

**If migration fails:**

1. Stop the application
2. Restore database from backup
3. Fix migration script
4. Test in staging
5. Retry deployment

**Manual rollback:**

```sql
-- Review migration SQL and create reverse migration
-- Example: If migration added a column, remove it
ALTER TABLE table_name DROP COLUMN column_name;
```

---

## Rollback Procedures

### Application Rollback

**Using Docker Compose:**

```bash
# Stop current containers
docker compose down

# Checkout previous version
git checkout [previous-commit]

# Rebuild and restart
docker compose build
docker compose up -d
```

**Using Container Registry:**

```bash
# Deploy previous image version
docker compose pull [previous-image-tag]
docker compose up -d
```

### Database Rollback

**If migration needs rollback:**

1. Restore database from backup
2. Or manually reverse migration SQL
3. Verify data integrity

**Backup restoration:**

```bash
# Restore from backup
pg_restore -d database_name backup_file.dump

# Or using Docker
docker exec -it mre-postgres pg_restore -U pacetracer -d pacetracer backup_file.dump
```

---

## Health Check Procedures

### Application Health Check

**Endpoint:** `GET /api/health`

**Authentication:** This endpoint is **public** and does not require
authentication. It is configured as a public API endpoint to allow Docker health
checks and orchestration tools to verify service availability without
credentials.

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-27T00:00:00.000Z"
  },
  "message": "Service is healthy"
}
```

**Check Script:**

```bash
# Works without authentication
curl http://localhost:3001/api/health
```

### Container Health Checks

**Docker Compose Configuration:** The `docker-compose.yml` file includes a
health check configuration that uses the public `/api/health` endpoint:

```yaml
healthcheck:
  test:
    [
      "CMD",
      "wget",
      "--quiet",
      "--tries=1",
      "--spider",
      "http://localhost:3001/api/health",
    ]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Why `/api/health` is public:**

- Docker health checks cannot authenticate
- Orchestration tools (Kubernetes, Docker Swarm) need unauthenticated health
  checks
- The endpoint only returns basic service status (no sensitive data)

**Public API Endpoints:** The following endpoints do not require authentication:

- `/api/health` - Health check endpoint (for Docker/orchestration)
- `/api/v1/auth/login` - User authentication
- `/api/v1/auth/register` - User registration
- `/api/auth/*` - NextAuth internal routes

All other API endpoints require authentication.

**Check Container Health:**

```bash
docker ps
# Check STATUS column for "healthy"
```

### Database Health Check

**Connection Test:**

```bash
docker exec -it mre-postgres psql -U pacetracer -d pacetracer -c "SELECT 1"
```

**Ingestion Service Health:**

```bash
curl http://localhost:8000/health
```

---

## Post-Deployment Verification

### Smoke Tests

**Placeholder:** Automated smoke tests will be added

**Manual Checks:**

1. Health endpoint returns 200 OK
2. Application loads in browser
3. Login functionality works
4. API endpoints respond correctly
5. Database queries succeed

### Monitoring

**Check Logs:**

```bash
# Application logs
docker logs -f mre-app

# Ingestion service logs
docker logs -f mre-liverc-ingestion-service

# Database logs
docker logs -f mre-postgres
```

**Check Metrics:**

- **Placeholder:** Metrics dashboard setup

---

## Monitoring and Alerting Setup

**Placeholder:** Monitoring and alerting configuration will be documented

### Recommended Monitoring

1. **Application Metrics**
   - Response times
   - Error rates
   - Request counts
   - Memory usage
   - CPU usage

2. **Database Metrics**
   - Connection pool usage
   - Query performance
   - Database size
   - Replication lag (if applicable)

3. **Infrastructure Metrics**
   - Container health
   - Network latency
   - Disk usage
   - Resource utilization

### Alerting

**Placeholder:** Alerting configuration will be documented

**Recommended Alerts:**

- Health check failures
- High error rates
- Database connection failures
- High memory/CPU usage
- Disk space low

---

## Disaster Recovery Procedures

**Placeholder:** Disaster recovery procedures will be documented

### Backup Strategy

**Database Backups:**

- **Placeholder:** Automated backup schedule
- **Frequency:** Daily (recommended)
- **Retention:** 30 days (recommended)
- **Storage:** Secure, off-site location

### Recovery Procedures

**Placeholder:** Recovery procedures will be documented

**Steps:**

1. Assess damage
2. Restore from backup
3. Verify data integrity
4. Restart services
5. Verify functionality
6. Document incident

---

## Related Documentation

- [Docker Review Report](../reviews/DOCKER_REVIEW_REPORT.md) - Docker setup
  details
- [Environment Variables Reference](./environment-variables.md) - Configuration
- [Quick Start Guide](../development/quick-start.md) - Development setup
- [Observability Guide](./observability-guide.md) - Monitoring and logging

---

**End of Deployment Guide**
