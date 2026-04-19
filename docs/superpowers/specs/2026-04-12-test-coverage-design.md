# Test Coverage Design

**Date:** 2026-04-12
**Status:** Draft

## Summary

Expand the test suite to cover all three operation flows end-to-end, log persistence, pagination × selection interactions, missing `TagTable` cell states, and `MergeDialog` keyboard navigation. Add coverage enforcement to the Jest config and CI pipeline.

---

## Problem Areas

| Area | Current tests | Gap |
|------|--------------|-----|
| `TagManagerApp` delete flow | None | Confirm → execute → tag removed from list → log entry |
| `TagManagerApp` merge flow | None | Confirm → execute → list reloaded → log entry |
| `TagManagerApp` count flow | None | Spinner per tag → resolve → count displayed |
| Partial operation failures | None | One of N tags fails; others succeed; failed tags re-selected |
| Log persistence | None | localStorage seeded before mount; written after operation |
| Corrupted localStorage | None | Graceful fallback to empty log |
| Pagination navigation | None | Page 1 → Next → Page 2; page resets on filter change |
| Pagination × selection | None | Select-all on page 1 does not select page-2 tags |
| `TagTable` count column | None | `count: undefined` shows "—"; `count: -1` shows spinner; `count: 7` shows "7" |
| `MergeDialog` keyboard nav | None | ArrowDown/Up, Enter to select, Escape closes dropdown |
| Coverage enforcement | None | No threshold; CI does not fail on low coverage |
| `userEvent` adoption | None installed but unused | `fireEvent` used throughout; misses focus/blur/keyboard sequences |

---

## Architecture

No production code changes. All work is in test files and configuration.

### File structure

```
src/
  app/
    TagManagerApp.test.tsx          ← extend (operations + selection)
    TagManagerApp.log.test.tsx      ← new (localStorage persistence)
    TagManagerApp.pagination.test.tsx ← new (page nav + selection across pages)
    TagTable.test.tsx               ← extend (count column states)
    MergeDialog.test.tsx            ← extend (keyboard nav)
  test/
    setupTests.ts                   ← add userEvent imports if needed
jest.config.js (or package.json)    ← add coverageThreshold
.github/workflows/build.yml         ← add --coverage flag to test step
```

---

## Test Designs

### `TagManagerApp` operation flows (extend existing file)

**Delete — success path**
1. Load tags `[alpha, beta]`
2. Select `alpha` (click its checkbox)
3. Click "Delete (1)"
4. `DeleteDialog` renders — click confirm button
5. Assert `deleteTagById("1")` called
6. Assert `alpha` no longer in the DOM
7. Assert activity log contains `✓ Deleted "alpha"`

**Delete — partial failure**
1. Load tags `[alpha, beta]`
2. Select both
3. Confirm delete
4. `deleteTagById` resolves for `alpha`, throws for `beta`
5. Assert `alpha` gone, `beta` still in DOM
6. Assert log contains one success entry and one error entry

**Merge — success path**
1. Load tags `[old-tag, platform]`
2. Select `old-tag`
3. Click "Merge (1)" → type "platform" → click Merge
4. Assert `mergeTag("1", "old-tag", "platform")` called
5. Assert `getAllTags` called a second time (list reload)
6. Assert log contains `✓ Merged "old-tag" → "platform" (1 work item updated)`

**Count — success path**
1. Load tags `[alpha, beta]`
2. Select both
3. Click "Count (2)" (< threshold, no confirm dialog)
4. Assert both rows show a spinner (`count === -1`)
5. Resolve both `countTagAcrossProjects` calls with `3` and `0`
6. Assert `alpha` row shows "3", `beta` row shows "0"
7. Assert log contains two success entries

### `TagManagerApp.log.test.tsx` (new file)

**Pre-seeded log renders on mount**
1. Write a valid log JSON array to `localStorage` before rendering
2. Render `TagManagerApp` (mock `getAllTags` to resolve immediately)
3. Click the "Activity Log" toggle
4. Assert the pre-seeded entries are visible

**Log written after operation**
1. Render, load tags, run a delete
2. Assert `localStorage.getItem(LOG_STORAGE_KEY)` contains the new entry after `waitFor`

**Corrupted localStorage does not crash**
1. Write `"not-json"` to `localStorage` under `LOG_STORAGE_KEY`
2. Render `TagManagerApp`
3. Assert app renders without throwing (no error boundary triggered)
4. Assert log is empty (graceful fallback)

### `TagManagerApp.pagination.test.tsx` (new file)

Uses 30 tags (> PAGE_SIZE 25).

**Page navigation**
1. Assert 25 rows visible on page 1
2. Assert "Page 1 of 2" text
3. Click "Next →"
4. Assert 5 rows visible on page 2

**Alpha filter resets page**
1. Load 30 tags all starting with "A"
2. Navigate to page 2
3. Click alpha "A"
4. Assert back on page 1

**Select-all is scoped to current page**
1. Navigate to page 1
2. Click select-all checkbox
3. Assert 25 tags selected (not 30)
4. Navigate to page 2
5. Assert checkboxes on page 2 are unchecked

### `TagTable` count column (extend existing file)

```
{ id: "1", name: "alpha", url: "u" }                  → "—" in count cell
{ id: "2", name: "beta",  url: "u", count: -1 }       → spinner in count cell
{ id: "3", name: "gamma", url: "u", count: 7 }        → "7" in count cell
```

### `MergeDialog` keyboard navigation (extend existing file, use `userEvent`)

**ArrowDown selects first suggestion**
1. Type "p" → dropdown opens with "platform" suggestion
2. Press ArrowDown
3. Press Enter
4. Assert input value is "platform"
5. Click Merge → assert `onConfirm("platform")` called

**Escape closes dropdown**
1. Type "p" → dropdown visible
2. Press Escape
3. Assert dropdown not in DOM

**Tab away closes dropdown**
1. Type "p" → dropdown visible
2. Tab to next focusable element
3. Assert dropdown not in DOM

---

## Coverage Enforcement

Add to `jest.config.js` (or `jest` key in `package.json`):

```json
"coverageThreshold": {
  "global": {
    "branches": 70,
    "functions": 80,
    "lines": 80,
    "statements": 80
  }
}
```

Update CI test step in `.github/workflows/build.yml`:

```yaml
- name: Test
  run: pnpm run test:coverage
```

`test:coverage` already runs `jest --coverage`. The threshold causes the step to exit non-zero if coverage drops below the configured values, blocking the PR merge.

---

## `userEvent` Adoption

`@testing-library/user-event` v14 is already installed. New tests that involve keyboard sequences (`MergeDialog`, pagination button clicks) use `userEvent.setup()` + `await userEvent.type()` / `await userEvent.keyboard()`. Existing `fireEvent` usage in unchanged tests is left as-is to avoid noisy diffs.

---

## Error Handling

No production error handling changes. Tests explicitly assert that error states (partial failures, localStorage corruption) render without crashing and produce the expected log entries.

---

## Files Created / Modified

| Action | File |
|--------|------|
| Extend | `src/app/TagManagerApp.test.tsx` |
| Create | `src/app/TagManagerApp.log.test.tsx` |
| Create | `src/app/TagManagerApp.pagination.test.tsx` |
| Extend | `src/app/TagTable.test.tsx` |
| Extend | `src/app/MergeDialog.test.tsx` |
| Modify | `jest.config.js` or `package.json` — add `coverageThreshold` |
| Modify | `.github/workflows/build.yml` — use `test:coverage` |

---

## Out of Scope

- E2E / browser tests (ADO extension environment is not reproducible in CI without a live org)
- Visual regression tests
- Performance benchmarks
- Adding tests for unchanged Hub bootstrap or StatusLog (already covered or trivial)
