---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: User stories for system-level features (under development page)
purpose: Defines user stories for system-level features and placeholders with detailed
         acceptance criteria, dependencies, and Definition of Done checklists.
relatedFiles:
  - docs/specs/mre-under-development-page.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/design/mre-ux-principles.md
---

# System Epic

This epic contains user stories for system-level features: the under development placeholder page.

---

## Under Development Page

**As a** User  
**I want** to see a placeholder message for future features  
**So that** I understand what's coming

### Priority
Low

### Dependencies
None

### Acceptance Criteria

1. **Required Message**
   - Page must display the following message exactly: "We're still building this feature, the pit crew is working on it!"
   - Message text cannot be modified, stylized with emojis, expanded, shortened, or contextualized
   - Message must be displayed prominently on the page

2. **Route Definition**
   - Page must be served at `/under-development` route
   - No alternate routes may be created
   - If a user navigates to a future feature link, that link must redirect to this route

3. **Layout Requirements**
   - Page must use the application's global layout shell
   - Page must include top navigation (Alpha or Future, depending on release phase)
   - Page must include the same padding and spacing scale as all pages
   - Page must use the same container components (flex or grid wrappers)
   - Page must follow dark theme rules

4. **Content Positioning**
   - Message must be centered horizontally
   - Message must be centered vertically (using flex or grid)
   - Typography must follow typography scale from the design system

5. **Dark Theme Compliance**
   - Background must use `--token-surface` (no pure black)
   - Text must use `--token-text-primary`
   - No pure black backgrounds
   - No unapproved accent colors

6. **Component Restrictions**
   - Allowed components:
     - Layout wrapper
     - Typography components
     - Standard spacing utilities
     - Dark theme visual tokens
   - Forbidden components:
     - Buttons
     - Links (except navigation)
     - Forms
     - Images
     - Icons
     - Cards
     - Lists
     - Navigation to features other than the landing page
   - Page must remain minimal for clarity and consistency

7. **Mobile-First Requirements**
   - Page must be fully functional on mobile devices
   - Layout must collapse gracefully on small screens
   - Message must be readable on mobile
   - No hover-only interactions

8. **Accessibility Requirements**
   - Page must use semantic HTML (`<main>` wrapper recommended)
   - Page must meet WCAG 2.1 AA contrast standards
   - Screen readers must read the message clearly
   - No motion or animation
   - Since page contains no controls, there are no interactive accessibility concerns

9. **Integration with Navigation**
   - In Alpha, none of the future features appear in navigation (only minimal authentication navigation)
   - Once full navigation is introduced (Beta/Production), any unfinished feature must use the Under Development page until implementation is complete
   - All future feature links must either navigate directly to `/under-development` or redirect server-side to `/under-development`

10. **Architecture Compliance**
    - Page must follow mobile-safe architecture guidelines
    - No business logic required (static placeholder page)
    - Page must be accessible without authentication (or with minimal restrictions)

### Definition of Done

- [ ] Under Development page implemented at `/under-development` route
- [ ] Exact message displayed: "We're still building this feature, the pit crew is working on it!"
- [ ] Message centered horizontally and vertically
- [ ] Global layout wrapper applied
- [ ] Dark theme tokens used throughout (no hardcoded colors)
- [ ] No forbidden components used
- [ ] Mobile layout verified on multiple screen sizes
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Screen reader compatibility verified
- [ ] Typography follows design system
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [Under Development Page Specification](../specs/mre-under-development-page.md)
- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
- [MRE UX Principles](../design/mre-ux-principles.md)
- [MRE Dark Theme Guidelines](../design/mre-dark-theme-guidelines.md)

