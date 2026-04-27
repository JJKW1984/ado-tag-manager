# Org-Wide Tag Count Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-tag WIQL count action with an org-wide Analytics OData cache stored in `IExtensionDataService`, auto-loaded on hub open, and manually refreshable via a header bar button.

**Architecture:** A new `TagCountCacheService` handles the Analytics OData fetch and `IExtensionDataService` read/write at collection scope. `TagManagerApp` reads the cache on mount to populate counts immediately, fires a background refresh when the cache is stale (>24h), and exposes a "Refresh Counts" button for on-demand refresh. The existing per-tag Count toolbar action and `CountConfirmDialog` are deleted.

**Tech Stack:** React 16 + TypeScript, `azure-devops-extension-sdk` v4, `azure-devops-extension-api` v4, Jest + Testing Library, ADO Analytics OData API v4.0-preview.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `src/services/TagCountCacheService.ts` | New service: OData fetch + `IExtensionDataService` cache I/O |
| Create | `src/services/TagCountCacheService.test.ts` | Unit tests for new service |
| Modify | `src/types/index.ts` | Add `TagCountCache` interface |
| Modify | `src/test/mocks/azureDevopsSdkMock.ts` | Add `getExtensionContext`, `mockExtensionDataManager`, `mockExtensionDataService` |
| Modify | `src/services/TagService.ts` | Remove `countTagAcrossProjects` |
| Modify | `src/services/TagService.test.ts` | Remove `countTagAcrossProjects` test |
| Modify | `src/app/TagTable.tsx` | Remove `count === -1` spinner branch |
| Modify | `src/app/TagManagerApp.tsx` | Remove count flow; add cache load + refresh UI |
| Modify | `src/app/TagManagerApp.test.tsx` | Remove count tests; add cache + refresh tests |
| Modify | `src/app/tag-manager.css` | Add `.tm-refresh-bar` and `.tm-last-updated` |
| Delete | `src/app/CountConfirmDialog.tsx` | No longer referenced |

---

## Task 1: Create Feature Branch

**Files:** none

- [ ] **Step 1: Create and check out the feature branch**

```bash
git checkout -b feature/org-tag-count-cache
```

Expected: `Switched to a new branch 'feature/org-tag-count-cache'`

---

## Task 2: Add `TagCountCache` Type + Extend SDK Mock

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/test/mocks/azureDevopsSdkMock.ts`

- [ ] **Step 1: Add `TagCountCache` interface to `src/types/index.ts`**

Replace the file content with:

```typescript
// src/types/index.ts

/** A tag as returned by GET _apis/wit/tags */
export interface TagItem {
  id: string;
  name: string;
  url: string;
  /** Populated from the org-wide count cache */
  count?: number;
}

/** Kept for applyTagUpdate return value (merge) */
export interface TagOperationResult {
  affectedCount: number;
  workItemIds: number[];
}

/** Org-wide tag count cache stored via IExtensionDataService */
export interface TagCountCache {
  counts: Record<string, number>;  // tag name (lowercase) → work item count
  lastUpdated: string;              // ISO 8601 timestamp
}
```

- [ ] **Step 2: Extend SDK mock with ExtensionDataService and getExtensionContext**

Replace `src/test/mocks/azureDevopsSdkMock.ts` with:

```typescript
type ProjectInfo = { name: string } | null;

type WorkItemContributionHandler = Record<string, (...args: unknown[]) => unknown>;

let projectInfo: ProjectInfo = { name: "Demo Project" };
const registeredHandlers: WorkItemContributionHandler[] = [];

export const mockInit = jest.fn().mockResolvedValue(undefined);
export const mockNotifyLoadSucceeded = jest.fn();
export const mockGetAccessToken = jest.fn().mockResolvedValue("test-access-token");
export const mockGetHost = jest.fn(() => ({ name: "demo-org" }));
export const mockGetExtensionContext = jest.fn(() => ({
  id: "test-publisher.test-extension",
}));

export const mockProjectPageService = {
  getProject: jest.fn(async () => projectInfo),
};

export const mockExtensionDataManager = {
  getValue: jest.fn(),
  setValue: jest.fn(),
};

export const mockExtensionDataService = {
  getExtensionDataManager: jest.fn(async () => mockExtensionDataManager),
};

export const mockGetService = jest.fn(async () => mockProjectPageService);

export const mockRegister = jest.fn(
  (_contributionId: string, handler: WorkItemContributionHandler) => {
    if (handler) {
      registeredHandlers.push(handler);
    }
  }
);

export function setMockProject(name: string | null): void {
  projectInfo = name ? { name } : null;
}

export function triggerRegisteredEvent(eventName: string, ...args: unknown[]): void {
  const handler = registeredHandlers[registeredHandlers.length - 1];
  if (!handler || typeof handler[eventName] !== "function") {
    throw new Error(`No registered handler for event: ${eventName}`);
  }
  handler[eventName](...args);
}

export function resetAzureDevopsSdkMock(): void {
  projectInfo = { name: "Demo Project" };
  registeredHandlers.length = 0;

  mockInit.mockClear();
  mockInit.mockResolvedValue(undefined);

  mockNotifyLoadSucceeded.mockClear();

  mockGetAccessToken.mockClear();
  mockGetAccessToken.mockResolvedValue("test-access-token");

  mockGetHost.mockClear();
  mockGetHost.mockReturnValue({ name: "demo-org" });

  mockGetExtensionContext.mockClear();
  mockGetExtensionContext.mockReturnValue({ id: "test-publisher.test-extension" });

  mockProjectPageService.getProject.mockClear();
  mockProjectPageService.getProject.mockImplementation(async () => projectInfo);

  mockExtensionDataManager.getValue.mockClear();
  mockExtensionDataManager.getValue.mockResolvedValue(undefined);

  mockExtensionDataManager.setValue.mockClear();
  mockExtensionDataManager.setValue.mockResolvedValue(undefined);

  mockExtensionDataService.getExtensionDataManager.mockClear();
  mockExtensionDataService.getExtensionDataManager.mockResolvedValue(mockExtensionDataManager);

  mockGetService.mockClear();
  mockGetService.mockImplementation(async () => mockProjectPageService);

  mockRegister.mockClear();
}

export function getRegisteredHandlerCount(): number {
  return registeredHandlers.length;
}

export const init = mockInit;
export const notifyLoadSucceeded = mockNotifyLoadSucceeded;
export const getAccessToken = mockGetAccessToken;
export const getHost = mockGetHost;
export const getExtensionContext = mockGetExtensionContext;
export const getService = mockGetService;
export const register = mockRegister;
```

- [ ] **Step 3: Run existing tests to confirm nothing is broken**

```bash
pnpm test --runInBand
```

Expected: All previously passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/test/mocks/azureDevopsSdkMock.ts
git commit -m "feat: add TagCountCache type and extend SDK mock with ExtensionDataService"
```

---

## Task 3: Create `TagCountCacheService` (TDD)

**Files:**
- Create: `src/services/TagCountCacheService.test.ts`
- Create: `src/services/TagCountCacheService.ts`

- [ ] **Step 1: Write the failing tests in `src/services/TagCountCacheService.test.ts`**

```typescript
import { TagCountCacheService } from "./TagCountCacheService";
import {
  mockGetService,
  mockGetAccessToken,
  mockExtensionDataManager,
  mockExtensionDataService,
} from "../test/mocks/azureDevopsSdkMock";

describe("TagCountCacheService", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockGetService.mockResolvedValue(mockExtensionDataService);
  });

  // --- getCache ---

  it("returns null when no value is stored", async () => {
    mockExtensionDataManager.getValue.mockResolvedValue(undefined);

    const service = new TagCountCacheService();
    const result = await service.getCache();

    expect(result).toBeNull();
  });

  it("returns stored cache when present", async () => {
    const stored = { counts: { bug: 5 }, lastUpdated: "2026-04-26T10:00:00.000Z" };
    mockExtensionDataManager.getValue.mockResolvedValue(stored);

    const service = new TagCountCacheService();
    const result = await service.getCache();

    expect(result).toEqual(stored);
  });

  it("reads with key 'orgTagCounts' and Default scope", async () => {
    mockExtensionDataManager.getValue.mockResolvedValue(undefined);

    const service = new TagCountCacheService();
    await service.getCache();

    expect(mockExtensionDataManager.getValue).toHaveBeenCalledWith(
      "orgTagCounts",
      { scopeType: "Default" }
    );
  });

  // --- setCache ---

  it("writes cache with key 'orgTagCounts' and Default scope", async () => {
    mockExtensionDataManager.setValue.mockResolvedValue(undefined);
    const cache = { counts: { bug: 3 }, lastUpdated: "2026-04-26T10:00:00.000Z" };

    const service = new TagCountCacheService();
    await service.setCache(cache);

    expect(mockExtensionDataManager.setValue).toHaveBeenCalledWith(
      "orgTagCounts",
      cache,
      { scopeType: "Default" }
    );
  });

  // --- fetchCounts ---

  it("calls Analytics OData with bearer token and normalizes tag names to lowercase", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          { Tags: { TagName: "Bug" }, Count: 10 },
          { Tags: { TagName: "Feature" }, Count: 5 },
        ],
      }),
    });

    const service = new TagCountCacheService();
    const counts = await service.fetchCounts("my-org");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("analytics.dev.azure.com/my-org");
    expect(url).toContain("$apply=groupby");
    expect((options.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-access-token"
    );
    expect(counts).toEqual({ bug: 10, feature: 5 });
  });

  it("skips entries with null or missing TagName", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          { Tags: { TagName: "ops" }, Count: 7 },
          { Tags: null, Count: 3 },
          { Tags: { TagName: null }, Count: 1 },
        ],
      }),
    });

    const service = new TagCountCacheService();
    const counts = await service.fetchCounts("my-org");

    expect(counts).toEqual({ ops: 7 });
  });

  it("throws on non-OK response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Access denied",
    });

    const service = new TagCountCacheService();
    await expect(service.fetchCounts("my-org")).rejects.toThrow("403");
  });

  // --- refreshCache ---

  it("fetches counts, stores cache, and returns the new cache object", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [{ Tags: { TagName: "ops" }, Count: 7 }],
      }),
    });
    mockExtensionDataManager.setValue.mockResolvedValue(undefined);

    const service = new TagCountCacheService();
    const result = await service.refreshCache("my-org");

    expect(result.counts).toEqual({ ops: 7 });
    expect(result.lastUpdated).toBeDefined();
    expect(new Date(result.lastUpdated).getTime()).toBeGreaterThan(0);
    expect(mockExtensionDataManager.setValue).toHaveBeenCalledWith(
      "orgTagCounts",
      expect.objectContaining({ counts: { ops: 7 } }),
      { scopeType: "Default" }
    );
  });

  // --- isStaleCacheOrMissing ---

  it("returns true when cache is null", () => {
    const service = new TagCountCacheService();
    expect(service.isStaleCacheOrMissing(null)).toBe(true);
  });

  it("returns true when lastUpdated is more than 24 hours ago", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const service = new TagCountCacheService();
    expect(service.isStaleCacheOrMissing({ counts: {}, lastUpdated: old })).toBe(true);
  });

  it("returns false when lastUpdated is less than 24 hours ago", () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    const service = new TagCountCacheService();
    expect(service.isStaleCacheOrMissing({ counts: {}, lastUpdated: recent })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they all fail**

```bash
pnpm test TagCountCacheService --runInBand
```

Expected: FAIL — `Cannot find module './TagCountCacheService'`

- [ ] **Step 3: Implement `src/services/TagCountCacheService.ts`**

```typescript
// src/services/TagCountCacheService.ts
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IExtensionDataService } from "azure-devops-extension-api/Common/CommonServices";
import { TagCountCache } from "../types";

const CACHE_KEY = "orgTagCounts";
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export class TagCountCacheService {
  private async getDataManager() {
    const dataService = await SDK.getService<IExtensionDataService>(
      CommonServiceIds.ExtensionDataService
    );
    const extensionId = SDK.getExtensionContext().id;
    const token = await SDK.getAccessToken();
    return dataService.getExtensionDataManager(extensionId, token);
  }

  async getCache(): Promise<TagCountCache | null> {
    const manager = await this.getDataManager();
    const value = await manager.getValue<TagCountCache>(CACHE_KEY, { scopeType: "Default" });
    return value ?? null;
  }

  async setCache(cache: TagCountCache): Promise<void> {
    const manager = await this.getDataManager();
    await manager.setValue(CACHE_KEY, cache, { scopeType: "Default" });
  }

  async fetchCounts(orgName: string): Promise<Record<string, number>> {
    const token = await SDK.getAccessToken();
    const url =
      `https://analytics.dev.azure.com/${encodeURIComponent(orgName)}/_odata/v4.0-preview/WorkItems` +
      `?$apply=groupby((Tags/TagName),aggregate($count as Count))`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Analytics OData: ${res.status} ${text}`);
    }

    const data = await res.json() as {
      value: Array<{ Tags: { TagName: string } | null; Count: number }>;
    };

    const counts: Record<string, number> = {};
    for (const item of data.value ?? []) {
      if (item.Tags?.TagName) {
        counts[item.Tags.TagName.toLowerCase()] = item.Count;
      }
    }
    return counts;
  }

  async refreshCache(orgName: string): Promise<TagCountCache> {
    const counts = await this.fetchCounts(orgName);
    const cache: TagCountCache = { counts, lastUpdated: new Date().toISOString() };
    await this.setCache(cache);
    return cache;
  }

  isStaleCacheOrMissing(cache: TagCountCache | null): boolean {
    if (!cache) return true;
    return Date.now() - new Date(cache.lastUpdated).getTime() > STALE_THRESHOLD_MS;
  }
}
```

- [ ] **Step 4: Run the tests to confirm they all pass**

```bash
pnpm test TagCountCacheService --runInBand
```

Expected: All tests in `TagCountCacheService.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/TagCountCacheService.ts src/services/TagCountCacheService.test.ts
git commit -m "feat: add TagCountCacheService with Analytics OData fetch and IExtensionDataService cache"
```

---

## Task 4: Remove `countTagAcrossProjects` from `TagService`

**Files:**
- Modify: `src/services/TagService.ts`
- Modify: `src/services/TagService.test.ts`

- [ ] **Step 1: Delete `countTagAcrossProjects` from `src/services/TagService.ts`**

Remove the entire method (lines 108–131 in the current file):

```typescript
// DELETE this entire method block:
  /**
   * Counts how many work items have this tag across ALL projects in the org.
   */
  async countTagAcrossProjects(tagName: string): Promise<number> {
    const coreClient = getClient(CoreRestClient);
    const witClient = getClient(WorkItemTrackingRestClient);
    const escaped = tagName.replace(/'/g, "''");

    // Fetch up to 1000 projects (handles most orgs; large orgs may need pagination)
    const projects = await coreClient.getProjects(undefined, 1000);
    let total = 0;

    for (const project of projects) {
      try {
        const result = await witClient.queryByWiql(
          {
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS '${escaped}' AND [System.TeamProject] = '${project.name.replace(/'/g, "''")}'`,
          },
          project.name
        );
        total += result.workItems?.length ?? 0;
      } catch {
        // Skip projects we can't query (permissions, etc.)
      }
    }
    return total;
  }
```

Also remove the now-unused imports at the top of `TagService.ts`. The `CoreRestClient` import is only used by `countTagAcrossProjects`. After removal, delete:

```typescript
import { CoreRestClient } from "azure-devops-extension-api/Core/CoreClient";
```

- [ ] **Step 2: Delete the `countTagAcrossProjects` test from `src/services/TagService.test.ts`**

Remove this entire test block:

```typescript
  it("counts matching work items across projects and skips project failures", async () => {
    mockCoreClient.getProjects.mockResolvedValue([
      { name: "Project A" },
      { name: "Project B" },
      { name: "Project C" },
    ]);

    mockWorkItemTrackingClient.queryByWiql
      .mockResolvedValueOnce({ workItems: [{ id: 1 }, { id: 2 }] })
      .mockRejectedValueOnce(new Error("forbidden"))
      .mockResolvedValueOnce({ workItems: [{ id: 3 }] });

    const service = new TagService();
    const count = await service.countTagAcrossProjects("bug");

    expect(count).toBe(3);
    expect(mockWorkItemTrackingClient.queryByWiql).toHaveBeenCalledTimes(3);
  });
```

Also remove the `mockCoreClient` import from `TagService.test.ts` since it's no longer used:

```typescript
// CHANGE this import (remove mockCoreClient):
import {
  mockCoreClient,
  mockWorkItemTrackingClient,
} from "../test/mocks/azureDevopsApiMock";

// TO:
import {
  mockWorkItemTrackingClient,
} from "../test/mocks/azureDevopsApiMock";
```

- [ ] **Step 3: Run TagService tests to confirm they pass**

```bash
pnpm test TagService --runInBand
```

Expected: All remaining `TagService.test.ts` tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/TagService.ts src/services/TagService.test.ts
git commit -m "feat: remove countTagAcrossProjects from TagService"
```

---

## Task 5: Update `TagTable` — Remove `-1` Spinner

**Files:**
- Modify: `src/app/TagTable.tsx`

- [ ] **Step 1: Replace the count cell renderer in `src/app/TagTable.tsx`**

Find the `Work Items` column `renderCell` (currently around line 120–133). Replace:

```typescript
          {item.count === undefined ? (
            <span style={{ color: "var(--palette-neutral-30, #aaa)" }}>—</span>
          ) : item.count === -1 ? (
            <Spinner size={SpinnerSize.small} />
          ) : (
            String(item.count)
          )}
```

With:

```typescript
          {item.count === undefined ? (
            <span style={{ color: "var(--palette-neutral-30, #aaa)" }}>—</span>
          ) : (
            String(item.count)
          )}
```

- [ ] **Step 2: Remove the now-unused `Spinner` and `SpinnerSize` imports from `TagTable.tsx`**

Remove this line from the imports at the top of `TagTable.tsx`:

```typescript
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
```

- [ ] **Step 3: Run TagTable tests to confirm they pass**

```bash
pnpm test TagTable --runInBand
```

Expected: All `TagTable.test.tsx` tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/TagTable.tsx
git commit -m "feat: remove per-row count spinner from TagTable"
```

---

## Task 6: Remove Count Flow from `TagManagerApp`

**Files:**
- Modify: `src/app/TagManagerApp.tsx`
- Delete: `src/app/CountConfirmDialog.tsx`

- [ ] **Step 1: Remove count-related imports from `src/app/TagManagerApp.tsx`**

Remove this import line:

```typescript
import { CountConfirmDialog } from "./CountConfirmDialog";
```

- [ ] **Step 2: Remove `countConfirm` from the `DialogState` type**

Change:

```typescript
type DialogState =
  | { type: "delete"; tags: TagItem[] }
  | { type: "merge"; sources: TagItem[] }
  | { type: "countConfirm"; tags: TagItem[] }
  | null;
```

To:

```typescript
type DialogState =
  | { type: "delete"; tags: TagItem[] }
  | { type: "merge"; sources: TagItem[] }
  | null;
```

- [ ] **Step 3: Remove `COUNT_CONFIRM_THRESHOLD` constant**

Delete this line:

```typescript
const COUNT_CONFIRM_THRESHOLD = 10;
```

- [ ] **Step 4: Remove `updateTagCount`, `handleCountClick`, and `runCountJobs` from `TagManagerApp`**

Delete these three functions in their entirety:

```typescript
  const updateTagCount = useCallback((tagId: string, count: number) => {
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, count } : t))
    );
  }, []);
```

```typescript
  const handleCountClick = () => {
    const selected = tags.filter((t) => selectedIds.has(t.id));
    if (selected.length > COUNT_CONFIRM_THRESHOLD) {
      setDialog({ type: "countConfirm", tags: selected });
    } else {
      runCountJobs(selected);
    }
  };
```

```typescript
  const runCountJobs = async (tagsToCount: TagItem[]) => {
    setDialog(null);
    // Mark each as counting (-1 sentinel)
    for (const tag of tagsToCount) {
      updateTagCount(tag.id, -1);
    }
    for (const tag of tagsToCount) {
      try {
        const count = await tagService.countTagAcrossProjects(tag.name);
        updateTagCount(tag.id, count);
      } catch (e) {
        updateTagCount(tag.id, 0);
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };
```

- [ ] **Step 5: Remove the `count` item from `commandBarItems`**

In the `commandBarItems` array, delete the entire `count` entry:

```typescript
    {
      id: "count",
      text: `Count${sel}`,
      iconProps: { iconName: "NumberSymbol" },
      disabled: n === 0,
      onActivate: handleCountClick,
      important: true,
    },
```

- [ ] **Step 6: Remove the `CountConfirmDialog` render block from the JSX**

Delete these lines at the bottom of the return:

```typescript
      {dialog?.type === "countConfirm" && (
        <CountConfirmDialog
          tags={dialog.tags}
          onConfirm={() => runCountJobs(dialog.tags)}
          onCancel={() => setDialog(null)}
        />
      )}
```

- [ ] **Step 7: Delete `src/app/CountConfirmDialog.tsx`**

```bash
rm src/app/CountConfirmDialog.tsx
```

- [ ] **Step 8: Run tests to confirm the app still compiles and existing tests pass**

```bash
pnpm test TagManagerApp --runInBand
```

Expected: Tests that reference `count`/`countTagAcrossProjects` will now fail — that is correct and expected. The non-count tests (pagination, loading, merge dialog, etc.) should still pass.

- [ ] **Step 9: Commit**

```bash
git add src/app/TagManagerApp.tsx
git rm src/app/CountConfirmDialog.tsx
git commit -m "feat: remove per-tag count flow and CountConfirmDialog"
```

---

## Task 7: Add Cache Load + Refresh UI to `TagManagerApp`

**Files:**
- Modify: `src/app/TagManagerApp.tsx`
- Modify: `src/app/tag-manager.css`

- [ ] **Step 1: Add SDK import and `TagCountCacheService` singleton to `TagManagerApp.tsx`**

Add to the imports section (after the existing `TagService` import):

```typescript
import * as SDK from "azure-devops-extension-sdk";
import { TagCountCacheService } from "../services/TagCountCacheService";
```

Add after the `const tagService = new TagService();` line:

```typescript
const tagCountCacheService = new TagCountCacheService();
```

- [ ] **Step 2: Add `lastUpdated` and `isRefreshing` state inside `TagManagerApp`**

Add these two `useState` calls directly after the existing state declarations (after the `searchQuery` state):

```typescript
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
```

- [ ] **Step 3: Add `triggerBackgroundRefresh` callback**

Add this `useCallback` directly after the `handleRename` callback:

```typescript
  const triggerBackgroundRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const orgName = SDK.getHost().name;
      const cache = await tagCountCacheService.refreshCache(orgName);
      setTags((prev) =>
        prev.map((t) => ({ ...t, count: cache.counts[t.name.toLowerCase()] }))
      );
      setLastUpdated(cache.lastUpdated);
    } catch (e) {
      setError(sanitizeError(e));
    } finally {
      setIsRefreshing(false);
    }
  }, []);
```

- [ ] **Step 4: Update `loadTags` to load from cache on mount**

Replace the existing `loadTags` implementation with:

```typescript
  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, cache] = await Promise.all([
        tagService.getAllTags(),
        tagCountCacheService.getCache(),
      ]);
      const tagsWithCounts = cache
        ? result.map((t) => ({ ...t, count: cache.counts[t.name.toLowerCase()] }))
        : result;
      setTags(tagsWithCounts);
      if (cache) setLastUpdated(cache.lastUpdated);
      setSelectedIds(new Set());
      if (tagCountCacheService.isStaleCacheOrMissing(cache)) {
        void triggerBackgroundRefresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [triggerBackgroundRefresh]);
```

- [ ] **Step 5: Add the refresh bar to the JSX**

Inside the `<div className="tm-card-content">` block, add the refresh bar **between** `<AlphaNav ... />` and the `{loading ? ...}` block:

```tsx
            <div className="tm-refresh-bar">
              <span className="tm-last-updated">
                Last updated:{" "}
                {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never"}
              </span>
              {isRefreshing && (
                <Spinner size={SpinnerSize.small} label="Refreshing…" />
              )}
              <Button
                text="Refresh Counts"
                iconProps={{ iconName: "Refresh" }}
                disabled={isRefreshing}
                onClick={triggerBackgroundRefresh}
              />
            </div>
```

Note: `Spinner`, `SpinnerSize`, and `Button` are already imported in `TagManagerApp.tsx`.

- [ ] **Step 6: Add refresh bar styles to `src/app/tag-manager.css`**

Append to the end of the file:

```css
/* Refresh bar (cache status + manual refresh button) */
.tm-refresh-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 4px;
  font-size: 13px;
}

.tm-last-updated {
  color: var(--palette-neutral-40, #888);
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/TagManagerApp.tsx src/app/tag-manager.css
git commit -m "feat: load tag counts from org-wide cache on mount with background refresh"
```

---

## Task 8: Update `TagManagerApp` Tests

**Files:**
- Modify: `src/app/TagManagerApp.test.tsx`

- [ ] **Step 1: Rewrite `src/app/TagManagerApp.test.tsx`**

Replace the entire file with:

```typescript
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockTagService = {
  getAllTags: jest.fn(),
  getProjectName: jest.fn(),
  deleteTagById: jest.fn(),
  renameTagById: jest.fn(),
  mergeTag: jest.fn(),
};

jest.mock("../services/TagService", () => ({
  TagService: jest.fn(() => mockTagService),
}));

const mockTagCountCacheService = {
  getCache: jest.fn(),
  setCache: jest.fn(),
  fetchCounts: jest.fn(),
  refreshCache: jest.fn(),
  isStaleCacheOrMissing: jest.fn(),
};

jest.mock("../services/TagCountCacheService", () => ({
  TagCountCacheService: jest.fn(() => mockTagCountCacheService),
}));

import { TagManagerApp } from "./TagManagerApp";

describe("TagManagerApp", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(mockTagService).forEach((fn) => fn.mockReset());
    Object.values(mockTagCountCacheService).forEach((fn) => fn.mockReset());

    mockTagService.getProjectName.mockResolvedValue("Demo Project");
    mockTagService.deleteTagById.mockResolvedValue(undefined);
    mockTagService.mergeTag.mockResolvedValue({
      affectedCount: 1,
      workItemIds: [1],
    });

    // Default: no cache, not stale (no auto-refresh)
    mockTagCountCacheService.getCache.mockResolvedValue(null);
    mockTagCountCacheService.isStaleCacheOrMissing.mockReturnValue(false);
    mockTagCountCacheService.refreshCache.mockResolvedValue({
      counts: {},
      lastUpdated: new Date().toISOString(),
    });
  });

  it("loads tags and renders Delete, Merge, and Refresh Counts buttons", async () => {
    mockTagService.getAllTags.mockResolvedValue([
      { id: "1", name: "alpha", url: "u" },
      { id: "2", name: "beta", url: "u" },
    ]);

    render(<TagManagerApp />);

    expect(screen.getByText(/Loading tags/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("alpha")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh Counts" })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "Count" })).toBeNull();
  });

  it("shows an error card when loading fails", async () => {
    mockTagService.getAllTags.mockRejectedValue(new Error("boom"));

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
  });

  it("shows 'Never' as last updated when no cache exists", async () => {
    mockTagService.getAllTags.mockResolvedValue([]);
    mockTagCountCacheService.getCache.mockResolvedValue(null);

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      expect(screen.getByText(/Never/)).toBeInTheDocument();
    });
  });

  it("shows formatted timestamp and populates counts when cache exists", async () => {
    mockTagService.getAllTags.mockResolvedValue([
      { id: "1", name: "bug", url: "u" },
    ]);
    mockTagCountCacheService.getCache.mockResolvedValue({
      counts: { bug: 42 },
      lastUpdated: "2026-04-26T10:00:00.000Z",
    });

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it("clicking Refresh Counts calls refreshCache and updates counts", async () => {
    mockTagService.getAllTags.mockResolvedValue([
      { id: "1", name: "ops", url: "u" },
    ]);
    mockTagCountCacheService.refreshCache.mockResolvedValue({
      counts: { ops: 99 },
      lastUpdated: new Date().toISOString(),
    });

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText("ops")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh Counts" }));

    await waitFor(() => {
      expect(screen.getByText("99")).toBeInTheDocument();
    });

    expect(mockTagCountCacheService.refreshCache).toHaveBeenCalledWith("demo-org");
  });

  it("auto-triggers background refresh when cache is stale on load", async () => {
    mockTagService.getAllTags.mockResolvedValue([
      { id: "1", name: "infra", url: "u" },
    ]);
    mockTagCountCacheService.isStaleCacheOrMissing.mockReturnValue(true);
    mockTagCountCacheService.refreshCache.mockResolvedValue({
      counts: { infra: 13 },
      lastUpdated: new Date().toISOString(),
    });

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(mockTagCountCacheService.refreshCache).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("13")).toBeInTheDocument();
    });
  });

  it("renders ADO pagination buttons when there are more than 25 tags", async () => {
    mockTagService.getAllTags.mockResolvedValue(
      Array.from({ length: 30 }, (_v, i) => ({
        id: `${i + 1}`,
        name: `tag-${String.fromCharCode(65 + (i % 26))}-${i + 1}`,
        url: "u",
      }))
    );

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText(/tag-A-1/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });

  it("uses correct icon names for Delete and Merge command bar items", async () => {
    mockTagService.getAllTags.mockResolvedValue([]);

    const { container } = render(<TagManagerApp />);

    await waitFor(() => {
      expect(container.querySelector('[data-icon="Delete"]')).not.toBeNull();
      expect(container.querySelector('[data-icon="BranchMerge"]')).not.toBeNull();
      expect(container.querySelector('[data-icon="NumberSymbol"]')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run all TagManagerApp tests to confirm they pass**

```bash
pnpm test TagManagerApp --runInBand
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/TagManagerApp.test.tsx
git commit -m "test: update TagManagerApp tests for cache-based count refresh"
```

---

## Task 9: Full Test Suite

- [ ] **Step 1: Run the complete test suite**

```bash
pnpm test --runInBand
```

Expected: All tests PASS. No reference to `CountConfirmDialog`, `countTagAcrossProjects`, or `count === -1` should remain.

- [ ] **Step 2: Verify no stray references to removed code**

```bash
grep -r "countTagAcrossProjects\|CountConfirmDialog\|runCountJobs\|handleCountClick\|countConfirm" src/
```

Expected: No output.

- [ ] **Step 3: Build to confirm TypeScript compiles cleanly**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Final commit if build produced any dist changes**

```bash
git add dist/
git commit -m "chore: rebuild dist for org-tag-count-cache feature"
```

---

## Verification Checklist

After implementation, manually verify in a browser against a real ADO org:

1. Open the Tag Manager hub — count column shows numbers immediately (no button click required)
2. Header shows "Last updated: [date]" with a real timestamp
3. Click "Refresh Counts" — spinner appears in header, counts update, timestamp updates to now
4. Reload the page — counts and timestamp persist without re-fetching
5. The old "Count" toolbar button does not appear
6. Merge and Delete toolbar actions still work correctly
