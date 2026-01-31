# Documentation Sync Review Implementation Plan

**Created**: 2026-01-16  
**Owner**: Documentation & Knowledge Steward  
**Objective**: Review existing documentation and identify areas where
documentation is not up-to-date with the actual codebase implementation. Create
a comprehensive audit of documentation gaps and create a plan to synchronize
documentation with the current build.

---

## 0. Guiding Goals

1. **Comprehensive Coverage** – Review all major documentation areas (API,
   architecture, database, operations, components, ingestion)
2. **Systematic Comparison** – Compare documentation against actual codebase
   implementation
3. **Prioritized Gaps** – Identify critical gaps that could mislead developers
   vs. minor documentation enhancements
4. **Actionable Items** – Provide specific, actionable tasks for updating
   documentation
5. **Maintainability** – Establish patterns for keeping documentation in sync
   going forward

---

## 1. Documentation Areas to Review

### 1.1 API Documentation (`docs/api/api-reference.md`)

**Review Scope:**

- Compare documented API endpoints with actual routes in `src/app/api/v1/`
- Verify request/response formats match actual implementation
- Check query parameters, authentication requirements, error codes
- Identify missing endpoints
- Identify deprecated or incorrect documentation

**Actual API Routes Found:**

- Authentication: `/auth/register`, `/auth/login`
- Admin: `/admin/audit`, `/admin/events`, `/admin/health`, `/admin/ingestion`,
  `/admin/logs`, `/admin/stats`, `/admin/tracks`,
  `/admin/track-sync/jobs/[jobId]`, `/admin/users`
- Events: `/events`, `/events/[eventId]`, `/events/[eventId]/analysis`,
  `/events/[eventId]/ingest`,
  `/events/[eventId]/race-classes/[className]/vehicle-type`,
  `/events/[eventId]/summary`, `/events/[eventId]/weather`,
  `/events/check-entry-lists`, `/events/discover`, `/events/ingest`,
  `/events/search`
- Drivers: `/drivers/[driverId]`
- Driver Profiles: `/driver-profiles`, `/driver-profiles/[id]`
- Car Profiles: `/car-profiles`, `/car-profiles/[id]`
- Health: `/health`
- Personas: `/personas`, `/personas/driver/events`,
  `/personas/team-manager/team`
- Race Results: `/race-results/[raceResultId]/laps`
- Races: `/races/[raceId]`, `/races/[raceId]/laps`
- Search: `/search`
- Tracks: `/tracks`
- Transponder Overrides: `/transponder-overrides`,
  `/transponder-overrides/[overrideId]`
- Users: `/users/me`, `/users/me/persona`, `/users/[userId]/driver-links`,
  `/users/[userId]/driver-links/events/[eventId]`, `/users/[userId]/profile`

**Tasks:**

- [ ] Audit each documented endpoint against actual route implementation
- [ ] Verify request body schemas match actual validation
- [ ] Verify response formats match actual API responses
- [ ] Check for missing endpoints (e.g., `/search`, `/car-profiles`,
      `/driver-profiles`, `/events/[eventId]/summary`,
      `/events/[eventId]/race-classes/[className]/vehicle-type`)
- [ ] Verify authentication requirements are correctly documented
- [ ] Check error response formats and codes
- [ ] Update documentation with any discrepancies found

---

### 1.2 Database Schema Documentation (`docs/database/schema.md`)

**Review Scope:**

- Compare documented models with `prisma/schema.prisma`
- Verify field types, constraints, indexes, relationships
- Check for new models not documented
- Check for field changes not reflected in docs
- Verify enum values

**Key Areas to Check:**

- All Prisma models: User, Persona, CarProfile, DriverProfile, Track, Event,
  EventEntry, EventRaceClass, Race, Driver, RaceDriver, RaceResult, Lap,
  TransponderOverride, WeatherData, UserDriverLink, EventDriverLink, AuditLog,
  ApplicationLog
- Enums: IngestDepth, PersonaType, UserDriverLinkStatus,
  EventDriverLinkMatchType, SessionType (if exists)
- Indexes and relationships
- Field names and types
- Default values and constraints

**Tasks:**

- [ ] Compare each model in schema.prisma with documentation
- [ ] Verify all fields are documented with correct types
- [ ] Check indexes are correctly documented
- [ ] Verify relationships and foreign keys
- [ ] Check enum values match
- [ ] Look for new models or fields added since last documentation update
      (2025-01-29)
- [ ] Verify migration notes are accurate

---

### 1.3 Architecture Documentation

#### 1.3.1 Mobile-Safe Architecture Guidelines (`docs/architecture/mobile-safe-architecture-guidelines.md`)

**Review Scope:**

- Verify folder structure matches actual codebase
- Check API-first patterns are followed
- Verify separation of UI and business logic
- Check core domain structure (`src/core/`)
- Verify authentication patterns

**Tasks:**

- [ ] Verify `src/core/` structure matches documented patterns
- [ ] Check API route structure matches guidelines
- [ ] Verify business logic separation (no Prisma in components)
- [ ] Check authentication implementation matches documented approach
- [ ] Verify response format standards are followed

#### 1.3.2 Dashboard Architecture (`docs/architecture/dashboard-architecture.md`)

**Review Scope:**

- Compare documented dashboard types with actual implementations
- Verify widget system documentation matches code
- Check dashboard pages exist as documented
- Verify customization features are implemented

**Actual Dashboard Pages Found:**

- `/dashboard` (main dashboard)
- `/dashboard/all-events`
- `/dashboard/car-profiles`
- `/dashboard/data-sources`
- `/dashboard/driver-profiles`
- `/dashboard/my-engineer`
- `/dashboard/my-event`
- `/dashboard/my-telemetry`
- `/dashboard/profile`

**Tasks:**

- [ ] Compare documented dashboard types with actual pages
- [ ] Verify widget system implementation matches documentation
- [ ] Check if customization features are implemented as documented
- [ ] Verify data fetching patterns match documentation
- [ ] Check mobile dashboard considerations are implemented

#### 1.3.3 LiveRC Ingestion Architecture (`docs/architecture/liverc-ingestion/`)

**Review Scope:**

- Review all 27 ingestion architecture documents
- Compare documented pipeline with `ingestion/ingestion/pipeline.py`
- Verify connector architecture matches `ingestion/connectors/liverc/`
- Check parser implementations match documentation
- Verify state machine and error handling match docs

**Key Files to Compare:**

- `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md` vs
  `ingestion/ingestion/pipeline.py`
- `docs/architecture/liverc-ingestion/02-connector-architecture.md` vs
  `ingestion/connectors/liverc/connector.py`
- Parser documentation vs `ingestion/connectors/liverc/parsers/`
- API contracts documentation vs actual API routes

**Tasks:**

- [ ] Compare pipeline implementation with documentation
- [ ] Verify connector architecture matches implementation
- [ ] Check parser implementations match documented selectors and logic
- [ ] Verify state machine documentation matches code
- [ ] Check error handling matches documented strategies
- [ ] Verify API contracts match actual ingestion API endpoints
- [ ] Check observability implementation (logging, metrics, tracing)

---

### 1.4 Operations Documentation

#### 1.4.1 Docker User Guide (`docs/operations/docker-user-guide.md`)

**Review Scope:**

- Compare documented Docker setup with `docker-compose.yml`
- Verify container names, ports, volumes match documentation
- Check environment variable documentation matches actual usage
- Verify command examples work as documented
- Check network configuration matches

**Tasks:**

- [ ] Compare docker-compose.yml with documented architecture
- [ ] Verify container names and ports match
- [ ] Check volume mounts are correctly documented
- [ ] Verify environment variables match
      `docs/operations/environment-variables.md`
- [ ] Test documented commands for accuracy
- [ ] Check network setup matches documentation

#### 1.4.2 Deployment Guide (`docs/operations/deployment-guide.md`)

**Review Scope:**

- Verify deployment steps match current setup
- Check environment configuration matches actual requirements
- Verify build processes are documented correctly

**Tasks:**

- [ ] Review deployment steps for accuracy
- [ ] Verify environment setup matches documentation
- [ ] Check build commands are correct
- [ ] Verify production considerations are accurate

#### 1.4.3 LiveRC Operations Guide (`docs/operations/liverc-operations-guide.md`)

**Review Scope:**

- Compare documented CLI commands with `ingestion/cli/commands.py`
- Verify cron job documentation matches actual scripts
- Check operational procedures match implementation

**Tasks:**

- [ ] Compare CLI command documentation with actual commands
- [ ] Verify cron job documentation matches `ingestion/crontab` and scripts
- [ ] Check operational procedures are accurate
- [ ] Verify troubleshooting steps are relevant

---

### 1.5 Frontend/Component Documentation

#### 1.5.1 Design Documentation (`docs/design/`)

**Review Scope:**

- Compare design guidelines with actual component implementations
- Verify theme system matches `src/app/globals.css` and theme components
- Check component patterns match design specs
- Verify navigation patterns match documented patterns

**Tasks:**

- [ ] Compare theme guidelines with actual CSS and theme implementation
- [ ] Check component patterns match design specifications
- [ ] Verify navigation patterns match documented patterns
- [ ] Check table component implementation matches
      `docs/design/table-component-specification.md`
- [ ] Verify chart design standards match actual chart implementations

#### 1.5.2 User Guides (`docs/user-guides/`)

**Review Scope:**

- Compare user guide content with actual pages and features
- Verify navigation instructions match actual routes
- Check feature descriptions match implementation
- Verify screenshots/examples (if any) match current UI

**Actual Pages Found:**

- `/dashboard/*` (multiple dashboard pages)
- `/event-search`
- `/events/analyse/[eventId]`
- `/drivers/[driverId]`
- `/admin/*` (multiple admin pages)
- `/guides/*` (guide pages)
- `/search`
- `/under-development`

**Tasks:**

- [ ] Compare user guide routes with actual page routes
- [ ] Verify feature descriptions match actual implementation
- [ ] Check navigation instructions are accurate
- [ ] Verify guide pages exist and match documentation
- [ ] Check for features documented that don't exist
- [ ] Check for features that exist but aren't documented

---

### 1.6 Development Documentation

#### 1.6.1 Quick Start Guide (`docs/development/quick-start.md`)

**Review Scope:**

- Verify setup instructions work as documented
- Check commands are accurate and work in Docker environment
- Verify prerequisites are correct
- Check troubleshooting steps are relevant

**Tasks:**

- [ ] Test setup instructions for accuracy
- [ ] Verify all commands work in Docker environment
- [ ] Check prerequisites are up-to-date
- [ ] Verify troubleshooting steps address current common issues
- [ ] Check IDE/editor recommendations are current

---

### 1.7 Domain Documentation

#### 1.7.1 Racing Classes Documentation (`docs/domain/racing-classes.md`)

**Review Scope:**

- Compare documented race classes with database schema
- Verify EventRaceClass model matches documentation
- Check vehicle type documentation matches implementation

**Tasks:**

- [ ] Compare documented classes with EventRaceClass model
- [ ] Verify vehicle type options match implementation
- [ ] Check class validation logic matches documentation

---

## 2. Systematic Review Process

### Phase 1: API Documentation Review (Priority: High)

**Objective:** Ensure API documentation is complete and accurate.

**Steps:**

1. List all actual API routes from `src/app/api/v1/` directory
2. Compare with `docs/api/api-reference.md`
3. For each endpoint:
   - Read actual route implementation
   - Compare request/response formats
   - Verify authentication requirements
   - Check error handling
4. Document discrepancies
5. Create update tasks

**Deliverable:** List of API documentation gaps with specific update
requirements.

---

### Phase 2: Database Schema Review (Priority: High)

**Objective:** Ensure schema documentation matches Prisma schema.

**Steps:**

1. Read `prisma/schema.prisma` completely
2. Compare each model with `docs/database/schema.md`
3. Check for:
   - New models not documented
   - Field changes (types, defaults, constraints)
   - New indexes
   - Relationship changes
   - Enum changes
4. Document discrepancies
5. Create update tasks

**Deliverable:** List of schema documentation gaps with specific updates needed.

---

### Phase 3: Architecture Documentation Review (Priority: Medium)

**Objective:** Verify architecture documentation reflects actual implementation
patterns.

**Steps:**

1. Review mobile-safe architecture guidelines against codebase structure
2. Compare dashboard architecture with actual dashboard implementation
3. Review ingestion architecture documents against ingestion code
4. Check for architectural changes not reflected in docs
5. Document discrepancies

**Deliverable:** List of architecture documentation gaps.

---

### Phase 4: Operations Documentation Review (Priority: Medium)

**Objective:** Ensure operational documentation is accurate and up-to-date.

**Steps:**

1. Compare Docker guide with docker-compose.yml
2. Test documented commands
3. Verify environment variable documentation
4. Check deployment procedures
5. Verify operational procedures match implementation

**Deliverable:** List of operations documentation gaps.

---

### Phase 5: Frontend/Component Documentation Review (Priority: Low)

**Objective:** Ensure design and user guide documentation matches
implementation.

**Steps:**

1. Compare design guidelines with component implementations
2. Verify user guides match actual pages and features
3. Check navigation patterns match documentation
4. Verify theme/design system documentation

**Deliverable:** List of frontend documentation gaps.

---

## 3. Documentation Update Tasks

### 3.1 High Priority Updates

These are critical gaps that could mislead developers or cause implementation
issues.

**Template for each gap:**

- **Document:** [path to document]
- **Section:** [specific section]
- **Issue:** [what's wrong or missing]
- **Current State:** [what the documentation says]
- **Actual State:** [what the code actually does]
- **Fix Required:** [specific changes needed]
- **Estimated Effort:** [time estimate]

### 3.2 Medium Priority Updates

These are important but less critical gaps that should be addressed.

### 3.3 Low Priority Updates

These are nice-to-have improvements and clarifications.

---

## 4. Documentation Maintenance Strategy

### 4.1 Prevention Strategies

To prevent documentation drift in the future:

1. **Documentation Review in PRs**
   - Require documentation updates for:
     - New API endpoints
     - Schema changes
     - Architecture changes
     - New features

2. **Automated Checks**
   - Consider generating API documentation from code (OpenAPI/Swagger)
   - Consider generating schema documentation from Prisma schema
   - Add documentation review checklist to PR template

3. **Regular Reviews**
   - Schedule quarterly documentation reviews
   - Review documentation when major features are added
   - Update documentation as part of refactoring

### 4.2 Documentation Standards

Establish standards for:

- When documentation must be updated
- Documentation format and structure
- Review process for documentation changes
- Ownership of documentation areas

---

## 5. Implementation Checklist

### Review Tasks

- [ ] Complete API documentation review (Phase 1)
- [ ] Complete database schema review (Phase 2)
- [ ] Complete architecture documentation review (Phase 3)
- [ ] Complete operations documentation review (Phase 4)
- [ ] Complete frontend/component documentation review (Phase 5)

### Documentation Updates

- [ ] Update API documentation with findings
- [ ] Update database schema documentation
- [ ] Update architecture documentation
- [ ] Update operations documentation
- [ ] Update frontend/component documentation

### Process Improvements

- [ ] Establish documentation update requirements for PRs
- [ ] Create documentation review checklist
- [ ] Set up documentation maintenance schedule
- [ ] Document documentation standards

---

## 6. Success Criteria

### Review Completeness

- ✅ All major documentation areas reviewed
- ✅ All API endpoints compared with documentation
- ✅ All database models compared with documentation
- ✅ Architecture documentation verified against implementation
- ✅ Operations documentation verified for accuracy

### Documentation Quality

- ✅ All critical gaps identified and documented
- ✅ Update tasks created for all gaps
- ✅ Priorities assigned to updates
- ✅ Maintenance strategy established

### Process Improvement

- ✅ Documentation maintenance process defined
- ✅ Standards established for future documentation updates
- ✅ Review schedule established

---

## 7. Estimated Timeline

- **Phase 1 (API Review):** 4-6 hours
- **Phase 2 (Schema Review):** 3-4 hours
- **Phase 3 (Architecture Review):** 6-8 hours
- **Phase 4 (Operations Review):** 3-4 hours
- **Phase 5 (Frontend Review):** 4-6 hours
- **Documentation Updates:** 8-12 hours (depending on gaps found)
- **Process Improvements:** 2-3 hours
- **Total:** ~30-43 hours (1-1.5 weeks)

---

## 8. Notes and Considerations

### Review Approach

- This plan focuses on systematic comparison rather than deep code analysis
- The goal is to identify discrepancies, not to validate correctness of
  implementation
- Some areas may require deeper investigation (e.g., ingestion pipeline
  internals)

### Documentation Philosophy

- Documentation should reflect actual implementation
- When implementation differs from documentation, update documentation (unless
  implementation is wrong)
- Documentation should be practical and accurate, not aspirational

### Collaboration

- This review should involve developers familiar with different areas of the
  codebase
- API review should involve backend developers
- Frontend review should involve frontend developers
- Operations review should involve DevOps/platform engineers

---

**End of Implementation Plan**
