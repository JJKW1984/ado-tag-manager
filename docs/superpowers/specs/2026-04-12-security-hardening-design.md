# Security Hardening Design

**Date:** 2026-04-12
**Status:** Draft

## Summary

Four targeted hardening changes to `TagService` and the UI layer, with no external dependencies added and no breaking API changes.

---

## Problem Areas

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | WIQL queries built by string interpolation; only `'` is escaped | `TagService.ts:111,140` | Medium |
| 2 | No input validation on merge target name (length, disallowed chars) | `MergeDialog.tsx` | Low–Medium |
| 3 | Cross-project count calls are sequential with no throttle or retry; silent 429 cascade | `TagService.ts:117–130` | Medium |
| 4 | Raw ADO error messages (including URLs and stack info) passed verbatim to the activity log | `TagManagerApp.tsx:163–165` | Low |

---

## Architecture

### 1 — WIQL Query Builder (`src/services/wiqlBuilder.ts`)

A single module exporting:

```
escapeWiql(value: string): string
buildTagWiql(tagName: string, projectName?: string): string
```

`escapeWiql` replaces `'` with `''` and brackets any value that contains square brackets or other WIQL metacharacters. `buildTagWiql` produces the full `SELECT [System.Id] FROM WorkItems WHERE ...` string.

All WIQL construction in `TagService` moves here. The two existing inline-interpolation sites (`countTagAcrossProjects`, `getWorkItemsWithTag`) are replaced with calls to `buildTagWiql`. The module is pure (no SDK imports) so it is trivially unit-testable.

### 2 — Tag Name Validation (`src/utils/validateTagName.ts`)

```
validateTagName(name: string): { valid: boolean; reason?: string }
```

Rules enforced:
- Non-empty after trim
- Max 256 characters (ADO documented limit)
- No semicolons — ADO uses `;` as a tag separator; a semicolon in a name silently creates two tags on the server

`MergeDialog` calls `validateTagName(trimmed)` on every keystroke. The Merge button is disabled while `!valid`. When `reason` is set and the user has typed at least one character, an inline error message renders below the input.

### 3 — Throttled Queue with Retry (`src/utils/rateLimitedQueue.ts`)

```
rateLimitedQueue<T>(
  tasks: Array<() => Promise<T>>,
  options: { concurrency: number; maxRetries: number; baseDelayMs: number }
): Promise<Array<T | Error>>
```

Runs at most `concurrency` promises simultaneously. On a 429 or 503 response (detected by checking `error.message` for the status code, since ADO throws rather than rejects with a Response object), the task is re-queued with exponential back-off (`baseDelayMs * 2^attempt`, capped at 30 s). After `maxRetries` the slot resolves with the `Error` instead of throwing, so other tasks continue.

`countTagAcrossProjects` replaces its `for...of` loop with a `rateLimitedQueue` call (concurrency = 3, maxRetries = 2, baseDelayMs = 500). The per-project try/catch is preserved — any Error values in the results array are counted as skipped.

No external dependencies. Pure Promise-based.

### 4 — Error Message Sanitization (`src/utils/sanitizeError.ts`)

```
sanitizeError(raw: unknown): string
```

Extracts `message` from an `Error` or stringifies the value, then:
- Strips anything matching `https?://\S+` (URLs)
- Strips anything after the first newline (cuts off stack traces)
- Truncates to 200 characters

Applied in `TagManagerApp` at the three `e instanceof Error ? e.message : String(e)` sites, replacing them with `sanitizeError(e)`.

---

## Data Flow

```
MergeDialog input
  → validateTagName() [client-side, instant]
  → onConfirm(trimmed) [only if valid]
  → tagService.mergeTag()
      → buildTagWiql() [escapes tag + project name]
      → ADO API

countTagAcrossProjects()
  → rateLimitedQueue(projectTasks, { concurrency: 3, ... })
      → buildTagWiql() per project
      → ADO API (max 3 in-flight)
      → retry on 429/503

ADO API error
  → sanitizeError(e)
  → activity log entry (clean, URL-free)
```

---

## Error Handling

- `validateTagName` failures are surfaced in the UI before any API call is made.
- `rateLimitedQueue` never throws; callers receive `Error` instances in the results array for failed slots.
- `sanitizeError` never throws; it always returns a string.

---

## Testing

| Test file | What it covers |
|-----------|---------------|
| `src/utils/wiqlBuilder.test.ts` | `escapeWiql` with single quotes, brackets, empty string; `buildTagWiql` with and without project name |
| `src/utils/validateTagName.test.ts` | Empty, whitespace-only, >256 chars, contains `;`, valid name |
| `src/utils/rateLimitedQueue.test.ts` | Concurrency cap (never exceeds N in-flight), retry on 429, gives up after maxRetries, non-retryable errors pass through immediately |
| `src/utils/sanitizeError.test.ts` | URL stripped, stack trace truncated, non-Error value stringified, truncation at 200 chars |
| `src/services/TagService.test.ts` (extended) | WIQL queries use escaped values; count uses queue (assert `queryByWiql` calls are concurrent); error log entries contain no raw URLs |

---

## Files Created / Modified

| Action | File |
|--------|------|
| Create | `src/utils/wiqlBuilder.ts` |
| Create | `src/utils/validateTagName.ts` |
| Create | `src/utils/rateLimitedQueue.ts` |
| Create | `src/utils/sanitizeError.ts` |
| Create | `src/utils/wiqlBuilder.test.ts` |
| Create | `src/utils/validateTagName.test.ts` |
| Create | `src/utils/rateLimitedQueue.test.ts` |
| Create | `src/utils/sanitizeError.test.ts` |
| Modify | `src/services/TagService.ts` — use `buildTagWiql`, replace loop with `rateLimitedQueue` |
| Modify | `src/app/MergeDialog.tsx` — call `validateTagName`, show inline error |
| Modify | `src/app/TagManagerApp.tsx` — wrap error strings with `sanitizeError` |
| Modify | `src/services/TagService.test.ts` — extend with sanitization and queue assertions |

---

## Out of Scope

- Content-Security-Policy headers (Hub.html is a static template generated by webpack; CSP belongs in the ADO extension host, not the extension itself)
- Authentication token handling (SDK-managed, not under our control)
- Server-side rate limiting (ADO enforces this; we only add client-side back-off)
