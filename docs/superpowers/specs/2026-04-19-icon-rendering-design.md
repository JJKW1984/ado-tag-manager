# Icon Rendering Reliability Design — Tag Manager Hub

**Date:** 2026-04-19  
**Scope:** Fix missing UI icons across the app by making icon assets and icon initialization explicit, verifiable, and app-wide.

---

## Problem Statement

The hub currently renders missing-glyph boxes where icons should appear (for example command bar actions, pagination chevrons, and row controls). The current setup relies on implicit icon/font availability. In Azure DevOps extension contexts, icon font assets are not always loaded unless explicitly wired.

This causes inconsistent UX and reduces confidence in destructive actions because visual affordances are degraded.

---

## Goals

- Restore icon rendering across all current icon consumers in the hub.
- Make icon availability explicit at startup, not incidental.
- Add guardrails so development/test fails quickly when icon prerequisites are broken.
- Keep existing business behavior unchanged (selection, merge/delete/count logic, paging, filters).

## Non-Goals

- Replacing Azure DevOps UI components with custom icon systems.
- Redesigning the command bar or table layout.
- Broad UI refactoring unrelated to icon rendering.

---

## Options Considered

### Option A (Recommended): Bundle icon assets + explicit runtime icon initialization

Use webpack asset handling to emit required Azure DevOps icon font/svg files, and add a startup bootstrap function that initializes icon support before the app renders.

**Pros**
- Preserves existing Azure DevOps UI patterns.
- Works app-wide for current and future `iconProps` usage.
- Clear failure modes and testability.

**Cons**
- Requires bundler config updates and one-time initialization wiring.

### Option B: Replace icon usage with inline SVG/Unicode per component

Rewrite icon-bearing controls to use custom icon markup.

**Pros**
- No icon font dependency.

**Cons**
- Large maintenance burden, duplicated icon semantics, divergence from ADO UI.

### Option C: CSS-only fallback glyphs

Keep current setup and overlay fallback characters/classes.

**Pros**
- Minimal touching of app bootstrapping.

**Cons**
- Fragile, inconsistent visuals, poor accessibility, does not solve root cause.

**Decision:** Option A.

---

## Proposed Architecture

Add a small icon bootstrap module with one responsibility: ensure icon support is initialized exactly once before first render.

1. `Hub.tsx` calls `initializeIconSupport()` before `ReactDOM.render(...)`.
2. `initializeIconSupport()` performs explicit icon setup and returns success/failure.
3. Webpack emits required font/svg assets with stable URLs consumed by CSS/runtime.
4. App render proceeds only after initialization path completes.

The change is additive and isolated to startup + build wiring, with no business-logic modifications.

---

## Component Boundaries

### `src/app/icons/initializeIconSupport.ts` (new)

Responsibilities:
- Perform one-time icon initialization.
- Surface explicit, actionable errors if prerequisites are unavailable.
- Export a narrow API (`initializeIconSupport(): void` or throws).

Constraints:
- No broad catches that hide failures.
- No UI logic inside this module.

### `src/hub/Hub.tsx`

Responsibilities:
- Execute initialization before first render.
- Route initialization failures through existing error-surfacing path.

### `webpack.config.js`

Responsibilities:
- Add asset rule(s) for icon/font file types used by Azure DevOps UI icon system.
- Ensure emitted files are part of `dist` and resolvable from extension host context.

---

## Data / Control Flow

1. Extension hub loads `hub.js`.
2. `SDK.init()` resolves.
3. `initializeIconSupport()` runs.
4. If successful, app renders and icons resolve normally.
5. If failed:
   - Development/test: throw immediately with clear message (fail-fast).
   - Production: surface explicit error in UI/log path and do not silently swallow.

This keeps failure explicit while protecting diagnosability.

---

## Error Handling Strategy

- Fail-fast in non-production contexts to prevent unnoticed regressions.
- No success-shaped fallback that pretends icons are fine.
- Error messages should name the missing initialization or asset type to shorten triage.
- Reuse existing app error presentation where possible instead of inventing parallel channels.

---

## Testing Strategy

### Unit tests

- Add tests for icon bootstrap:
  - initializes successfully when dependencies are available
  - throws with actionable message on initialization failure
  - idempotent behavior (multiple calls do not double-register)

### Integration/UI tests

- Extend existing app tests to confirm icon-bearing controls render without fallback missing-glyph characters in key views.
- Verify command bar and pagination controls continue to render and behave normally.

### Build guardrail

- Add an assertion in test/build flow that expected icon asset files are emitted to `dist`.
- CI should fail when emitted assets are missing.

---

## Impacted Files (Planned)

- `src/hub/Hub.tsx` (startup initialization call)
- `src/app/icons/initializeIconSupport.ts` (new bootstrap module)
- `webpack.config.js` (asset pipeline update)
- Relevant tests under `src/hub` and/or `src/app`

No changes expected in services (`TagService`) or tag operation business logic.

---

## Rollout / Validation

- Run existing project checks: `pnpm test` and `pnpm build`.
- Manual smoke validation in extension host:
  - command bar icons visible
  - pagination chevrons visible
  - row-level icons visible
  - no glyph boxes in normal flows

---

## Success Criteria

- Icons render correctly across the app in normal environments.
- Broken icon setup fails loudly during development/test.
- CI/build catches missing icon assets before release.
- No regression in tag operations or existing UI behaviors.

