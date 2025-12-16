# Project: My Race Engineer
# File: Dockerfile
# Summary: Multi-stage Dockerfile for development and production builds

# Stage 1: Dependencies
# Install all dependencies (including devDependencies) for development
FROM node:20-alpine AS deps
WORKDIR /app

# Install OpenSSL (may be needed for future dependencies)
RUN apk add --no-cache openssl libc6-compat

# Copy package files and Prisma schema (needed for postinstall script)
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install dependencies
# Using npm install with --legacy-peer-deps to handle React 19 peer dependency conflicts
RUN npm install --legacy-peer-deps

# Stage 2: Development
# Full development environment with hot reload
FROM node:20-alpine AS development
WORKDIR /app

# Install OpenSSL and wget (for health checks)
RUN apk add --no-cache openssl libc6-compat wget

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy application code
COPY . .

# Expose development port
EXPOSE 3001

# Set development environment
ENV NODE_ENV=development

# Use entrypoint script to ensure dependencies are installed
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start development server
CMD ["npm", "run", "dev"]

# Stage 3: Production Build
# Build the production bundle
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 4: Production Runtime
# Minimal production image
FROM node:20-alpine AS production
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install OpenSSL
RUN apk add --no-cache openssl libc6-compat wget

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose production port
EXPOSE 3001

# Start production server
CMD ["npm", "start"]

