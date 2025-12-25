# @fileoverview Dockerfile for LiveRC Ingestion Service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Multi-stage Dockerfile for Python ingestion microservice

FROM python:3.11-slim as base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    cron \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright system dependencies (needed before browser installation)
RUN playwright install-deps chromium

# Copy application code - create ingestion package structure
COPY . /app/ingestion/
WORKDIR /app

# Create symlink so tests/unit/ works in addition to ingestion/tests/unit/
RUN ln -s /app/ingestion/tests /app/tests

# Set PYTHONPATH so Python can find the ingestion module
ENV PYTHONPATH=/app

# Create non-root user for security
RUN groupadd -r -g 1001 ingestion && \
    useradd -r -u 1001 -g ingestion -m -d /home/ingestion ingestion && \
    chown -R ingestion:ingestion /app

# Install Playwright browsers for ingestion user (must be after user creation)
# This ensures browsers are installed in /home/ingestion/.cache/ms-playwright/
RUN su - ingestion -c "playwright install chromium" || \
    (echo "Warning: Playwright install failed, will retry at runtime" && \
     mkdir -p /home/ingestion/.cache && \
     chown -R ingestion:ingestion /home/ingestion/.cache)

# Set up cron directories and permissions
RUN mkdir -p /var/spool/cron/crontabs && \
    mkdir -p /var/log && \
    chown -R ingestion:ingestion /var/spool/cron && \
    chmod 755 /var/spool/cron/crontabs

# Test stage - extends base with test dependencies
FROM base as test

# Switch to root temporarily to install test dependencies
USER root

# Install test dependencies
COPY requirements-test.txt /app/
WORKDIR /app
RUN pip install --no-cache-dir -r requirements-test.txt

# Switch back to non-root user
USER ingestion

# Development stage - same as test (includes test dependencies for dev)
FROM test as development

# Switch to root to set up cron
USER root

# Copy cron files
COPY crontab /tmp/track-sync-crontab
COPY scripts/run-track-sync.sh /usr/local/bin/run-track-sync.sh
COPY scripts/run-followed-event-sync.sh /usr/local/bin/run-followed-event-sync.sh
COPY scripts/cron-entrypoint.sh /usr/local/bin/cron-entrypoint.sh

# Set up cron permissions and install crontab for ingestion user
RUN chmod +x /usr/local/bin/run-track-sync.sh && \
    chmod +x /usr/local/bin/run-followed-event-sync.sh && \
    chmod +x /usr/local/bin/cron-entrypoint.sh && \
    chown ingestion:ingestion /usr/local/bin/run-track-sync.sh && \
    chown ingestion:ingestion /usr/local/bin/run-followed-event-sync.sh && \
    chown ingestion:ingestion /usr/local/bin/cron-entrypoint.sh && \
    chown ingestion:ingestion /tmp/track-sync-crontab && \
    su - ingestion -c "crontab /tmp/track-sync-crontab" || true && \
    rm /tmp/track-sync-crontab && \
    # Ensure cron can write to log directory
    touch /var/log/track-sync.log /var/log/event-refresh.log && \
    chown ingestion:ingestion /var/log/track-sync.log /var/log/event-refresh.log && \
    chmod 644 /var/log/track-sync.log /var/log/event-refresh.log && \
    # Ensure Playwright browsers are installed for ingestion user
    su - ingestion -c "playwright install chromium" || true

# Expose API port
EXPOSE 8000

# Use entrypoint script that starts both cron and uvicorn
# Entrypoint runs as root to start cron, then switches to ingestion user for uvicorn
ENTRYPOINT ["/usr/local/bin/cron-entrypoint.sh"]

# Production stage - final image (same as base, no test deps)
FROM base as production

# Switch to root temporarily to copy cron files
USER root

# Copy cron files
COPY crontab /tmp/track-sync-crontab
COPY scripts/run-track-sync.sh /usr/local/bin/run-track-sync.sh
COPY scripts/run-followed-event-sync.sh /usr/local/bin/run-followed-event-sync.sh
COPY scripts/cron-entrypoint.sh /usr/local/bin/cron-entrypoint.sh

# Set up cron permissions and install crontab for ingestion user
RUN chmod +x /usr/local/bin/run-track-sync.sh && \
    chmod +x /usr/local/bin/run-followed-event-sync.sh && \
    chmod +x /usr/local/bin/cron-entrypoint.sh && \
    chown ingestion:ingestion /usr/local/bin/run-track-sync.sh && \
    chown ingestion:ingestion /usr/local/bin/run-followed-event-sync.sh && \
    chown ingestion:ingestion /usr/local/bin/cron-entrypoint.sh && \
    chown ingestion:ingestion /tmp/track-sync-crontab && \
    su - ingestion -c "crontab /tmp/track-sync-crontab" || true && \
    rm /tmp/track-sync-crontab && \
    # Ensure cron can write to log directory
    touch /var/log/track-sync.log /var/log/event-refresh.log && \
    chown ingestion:ingestion /var/log/track-sync.log /var/log/event-refresh.log && \
    chmod 644 /var/log/track-sync.log /var/log/event-refresh.log && \
    # Ensure Playwright browsers are installed for ingestion user
    su - ingestion -c "playwright install chromium" || true

# Expose API port
EXPOSE 8000

# Use entrypoint script that starts both cron and uvicorn
# Entrypoint runs as root to start cron, then switches to ingestion user for uvicorn
ENTRYPOINT ["/usr/local/bin/cron-entrypoint.sh"]
