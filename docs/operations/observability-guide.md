---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Comprehensive observability guide for MRE application
purpose:
  Provides detailed guidance for logging, metrics, tracing, alerting, dashboard
  setup, troubleshooting, and performance monitoring. Ensures consistent
  observability practices and helps with troubleshooting and performance
  optimization.
relatedFiles:
  - docs/roles/observability-incident-response-lead.md (role responsibilities)
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md (ingestion
    observability)
---

# Monitoring and Observability Guide

**Last Updated:** 2025-01-27  
**Scope:** All observability aspects of the MRE application

This document provides comprehensive guidance for logging, metrics, tracing,
alerting, and troubleshooting in the MRE application.

---

## Table of Contents

1. [Logging Standards and Practices](#logging-standards-and-practices)
2. [Metrics Collection](#metrics-collection)
3. [Tracing Setup](#tracing-setup)
4. [Alerting Configuration](#alerting-configuration)
5. [Dashboard Setup](#dashboard-setup)
6. [Troubleshooting with Observability Tools](#troubleshooting-with-observability-tools)
7. [Performance Monitoring](#performance-monitoring)

---

## Logging Standards and Practices

### Structured Logging

**Format:** JSON structured logs

**Required Fields:**

- `timestamp` - UTC timestamp
- `level` - Log level (info, warn, error)
- `message` - Human-readable message
- `service` - Service name (mre-app, liverc-ingestion-service)
- `context` - Additional context object

### Log Levels

**INFO:**

- Normal operation events
- Successful operations
- State changes

**WARN:**

- Recoverable errors
- Deprecated feature usage
- Performance concerns

**ERROR:**

- Errors that require attention
- Failed operations
- Exceptions

**DEBUG:**

- Detailed debugging information
- Development-only logs

### Logging Best Practices

1. **Use Structured Logs**
   - JSON format for machine parsing
   - Consistent field names
   - Include context

2. **Include Correlation IDs**
   - Track requests across services
   - Include in all log entries
   - Use for request tracing

3. **Avoid Sensitive Data**
   - Don't log passwords
   - Don't log full request bodies
   - Don't log PII unnecessarily

4. **Log at Appropriate Levels**
   - Use INFO for normal operations
   - Use WARN for recoverable issues
   - Use ERROR for failures

### Python Ingestion Service Logging

**Current Implementation:**

- Structured JSON logging
- Log levels: DEBUG, INFO, WARNING, ERROR
- Configuration via `LOG_LEVEL` environment variable

**See:** `docs/architecture/liverc-ingestion/15-ingestion-observability.md` for
detailed ingestion logging.

### Next.js Application Logging

**Current Implementation:**

- Console logging (development)
- Error logging in API routes
- **Placeholder:** Structured logging will be implemented

**Future Implementation:**

- Structured JSON logging
- Log aggregation service
- Correlation IDs

---

## Metrics Collection

### Application Metrics

**Placeholder:** Metrics collection will be implemented

**Recommended Metrics:**

- Request count (by endpoint)
- Response time (p50, p95, p99)
- Error rate (by endpoint)
- Active connections
- Memory usage
- CPU usage

### Database Metrics

**Placeholder:** Database metrics will be collected

**Recommended Metrics:**

- Query performance
- Connection pool usage
- Slow queries
- Database size
- Transaction rate

### Ingestion Metrics

**See:** `docs/architecture/liverc-ingestion/15-ingestion-observability.md` for
ingestion metrics.

**Key Metrics:**

- Ingestion duration
- Race page fetch duration
- Lap extraction count
- Database write operations
- Error rates
- **Practice day full ingestion:** duration, success/failure, sessions_ingested, sessions_with_laps, laps_ingested, sessions_detail_failed (see ingestion observability doc)

---

## Tracing Setup

**Placeholder:** Distributed tracing will be implemented

### Tracing Requirements

**Recommended:**

- Distributed tracing across services
- Request correlation
- Span creation for operations
- Trace sampling

### Tracing Tools

**Placeholder:** Tracing tool will be selected

**Recommended Tools:**

- OpenTelemetry - Standard tracing
- Jaeger - Trace visualization
- Zipkin - Distributed tracing

---

## Alerting Configuration

**Placeholder:** Alerting configuration will be documented

### Alert Categories

1. **Critical Alerts**
   - Service down
   - Database unavailable
   - High error rate

2. **Warning Alerts**
   - High response time
   - High memory usage
   - Slow queries

3. **Info Alerts**
   - Deployment notifications
   - Scheduled maintenance

### Alert Thresholds

**Placeholder:** Alert thresholds will be configured

**Recommended Thresholds:**

- Error rate > 1% for 5 minutes
- Response time p95 > 2 seconds
- Memory usage > 90%
- CPU usage > 80% for 5 minutes
- Database connection pool > 80%

### Alert Channels

**Placeholder:** Alert channels will be configured

**Recommended Channels:**

- Email notifications
- Slack/Teams integration
- PagerDuty (for critical)
- SMS (for critical)

---

## Dashboard Setup

**Placeholder:** Dashboard configuration will be documented

### Recommended Dashboards

1. **Application Dashboard**
   - Request rates
   - Response times
   - Error rates
   - Active users

2. **Database Dashboard**
   - Query performance
   - Connection pool
   - Database size
   - Slow queries

3. **Infrastructure Dashboard**
   - CPU usage
   - Memory usage
   - Network traffic
   - Disk usage

4. **Ingestion Dashboard**
   - Ingestion success rate
   - Ingestion duration
   - Events ingested
   - Error rates

### Dashboard Tools

**Placeholder:** Dashboard tool will be selected

**Recommended Tools:**

- Grafana - Visualization
- Datadog - Monitoring platform
- New Relic - APM platform

---

## Troubleshooting with Observability Tools

### Common Issues

**High Error Rate:**

1. Check error logs for patterns
2. Review error messages
3. Check recent deployments
4. Review database logs

**Slow Response Times:**

1. Check slow query logs
2. Review database metrics
3. Check application metrics
4. Review network latency

**Service Unavailable:**

1. Check health endpoints
2. Review container logs
3. Check infrastructure metrics
4. Review recent changes

### Troubleshooting Workflow

1. **Identify Issue**
   - Check dashboards
   - Review alerts
   - Check logs

2. **Gather Context**
   - Collect relevant logs
   - Review metrics
   - Check traces

3. **Investigate**
   - Analyze logs
   - Review code changes
   - Check dependencies

4. **Resolve**
   - Fix issue
   - Deploy fix
   - Verify resolution

5. **Document**
   - Update runbooks
   - Document root cause
   - Update alerts if needed

---

## Performance Monitoring

### Key Performance Indicators

**Application:**

- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate
- Availability

**Database:**

- Query performance
- Connection pool usage
- Slow query count
- Database size

**Infrastructure:**

- CPU usage
- Memory usage
- Network latency
- Disk I/O

### Performance Baselines

**Placeholder:** Performance baselines will be established

**Recommended Baselines:**

- API response time p95 < 1 second
- Error rate < 0.1%
- Database query time < 200ms (p95)
- CPU usage < 70%
- Memory usage < 80%

### Performance Monitoring Tools

**Placeholder:** Performance monitoring tools will be selected

**Recommended:**

- Application Performance Monitoring (APM)
- Database performance monitoring
- Infrastructure monitoring
- Real User Monitoring (RUM)

---

## Related Documentation

- [Observability & Incident Response Lead Role](../roles/observability-incident-response-lead.md) -
  Role responsibilities
- [Ingestion Observability](../architecture/liverc-ingestion/15-ingestion-observability.md) -
  Ingestion-specific observability
- [Performance Requirements](../architecture/performance-requirements.md) -
  Performance targets
- [Deployment Guide](./deployment-guide.md) - Deployment monitoring

---

**End of Observability Guide**
