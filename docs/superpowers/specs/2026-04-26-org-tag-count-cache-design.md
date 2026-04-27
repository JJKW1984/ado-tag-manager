# Org-Wide Tag Count Cache

**Date:** 2026-04-26
**Branch:** feature/org-tag-count-cache

## Context

Tag count data is currently computed on-demand via individual WIQL queries against every project in the organization. This is slow (N queries for N projects), ephemeral (lost on page refresh), and requires explicit user action to populate. The design replaces this with a single Analytics OData aggregate query whose results are cached at org scope via `IExtensionDataService`, persisted across page loads, auto-refreshed daily, and manually refreshable on demand. The existing per-tag count toolbar action is removed.

---

## Architecture

```
Hub opens
  → TagCountCacheService.getCache()        // reads IExtensionDataService (org scope)
  → cache exists → populate count column immediately
  → cache missing OR lastUpdated > 24h    → auto-trigger background refresh
  → "Refresh Counts" button               → always triggers background refresh

Background refresh:
  → Analytics OData API (single aggregate query)
  → TagCountCacheService.setCache()        // writes updated cache to IExtensionDataService
  → TagManagerApp updates counts + lastUpdated display in-place
```

---

## New File: `src/services/TagCountCacheService.ts`

Responsible for all cache I/O and the Analytics OData HTTP call. No React dependency.

### Cache Schema

```typescript
interface TagCountCache {
  counts: Record<string, number>;  // tag name (lowercase) → work item count
  lastUpdated: string;             // ISO 8601 timestamp
}
```

**Storage:** `IExtensionDataService` collection-scoped document (shared across all org users).
**Key:** `orgTagCounts`
**Scope:** `ExtensionStorageScope.Default` (organization-level)

### Analytics OData Query

Single HTTP GET replaces N per-project WIQL queries:

```
GET https://analytics.dev.azure.com/{org}/_odata/v4.0-preview/WorkItems
  ?$apply=groupby((Tags/TagName),aggregate($count as Count))
```

**Auth:** `Authorization: Bearer {token}` via `SDK.getAccessToken()` — same pattern as `TagService`.

**Expected response shape:**
```json
{
  "value": [
    { "Tags": { "TagName": "bug" }, "Count": 42 },
    { "Tags": { "TagName": "feature" }, "Count": 15 }
  ]
}
```

### Public API

```typescript
class TagCountCacheService {
  // Read cached counts from IExtensionDataService. Returns null if never set.
  async getCache(): Promise<TagCountCache | null>

  // Write updated cache to IExtensionDataService.
  async setCache(cache: TagCountCache): Promise<void>

  // Call Analytics OData and return a counts map.
  async fetchCounts(orgName: string): Promise<Record<string, number>>

  // fetchCounts + setCache in one step. Returns the new cache.
  async refreshCache(orgName: string): Promise<TagCountCache>

  // True if cache is null or lastUpdated is more than 24 hours ago.
  isStaleCacheOrMissing(cache: TagCountCache | null): boolean
}
```

---

## Changes to `src/app/TagManagerApp.tsx`

### State additions

```typescript
lastUpdated: string | null;   // ISO string from cache, null if never refreshed
isRefreshing: boolean;        // true while background refresh is running
```

### On mount (after tags load)

1. Call `TagCountCacheService.getCache()`
2. If cache exists: populate `count` on each `TagItem` from `cache.counts[tag.name]`; set `lastUpdated`
3. If `isStaleCacheOrMissing(cache)`: call `triggerBackgroundRefresh()` without awaiting (fire-and-forget)

### `triggerBackgroundRefresh()`

- Sets `isRefreshing = true`
- Calls `TagCountCacheService.refreshCache(orgName)`
- On success: updates all tag counts in state from new cache, sets `lastUpdated`, sets `isRefreshing = false`
- On error: sets `isRefreshing = false`, surfaces error via existing error handling

### Header bar additions

Rendered above the tag table:

```
Last updated: Apr 25, 2026 at 3:42 PM    [Refresh Counts ↻]
                                           (spinner when isRefreshing)
```

- "Never" shown when `lastUpdated` is null
- Refresh button is disabled while `isRefreshing` is true
- UI (table, search, pagination, actions) remains fully interactive during refresh

---

## Removed Functionality

| What | Where | Replacement |
|------|-------|-------------|
| `runCountJobs()` method | `TagManagerApp.tsx` | `triggerBackgroundRefresh()` |
| Per-tag count toolbar button | `TagManagerApp.tsx` toolbar | Refresh button in header |
| `TagService.countTagAcrossProjects()` | `TagService.ts` | `TagCountCacheService.fetchCounts()` |
| Count spinner per row (`count === -1`) | `TagTable.tsx` | Single header-level loading indicator |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/services/TagCountCacheService.ts` | New service: OData fetch + cache I/O |

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/TagManagerApp.tsx` | Remove `runCountJobs`, add cache load on mount, add refresh trigger, add header UI |
| `src/services/TagService.ts` | Remove `countTagAcrossProjects` |
| `src/app/TagTable.tsx` | Remove per-row count spinner logic (count is always a number or undefined) |
| `src/types/index.ts` | Add `TagCountCache` interface; keep `count?: number` on `TagItem` |

---

## Verification

1. Open the Tag Manager hub — count column populates from cache without any user action
2. "Last updated" timestamp appears in the header
3. Click "Refresh Counts" — spinner appears in header, table stays interactive, counts update, timestamp updates
4. Reload the page — counts and timestamp persist (loaded from `IExtensionDataService`)
5. Manually set `lastUpdated` to >24h ago in extension storage — on next hub load, auto-refresh fires
6. Confirm the old per-tag Count button no longer appears in the toolbar
