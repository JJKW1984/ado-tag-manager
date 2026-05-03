# Feature Additions Design

**Date:** 2026-04-12
**Status:** Draft

## Summary

Three additive features in priority order: inline tag rename (the service layer already exists), free-text search, and CSV/JSON export. No existing behaviour is changed.

---

## Feature A — Inline Rename

### Motivation

`TagService.renameTagById` is fully implemented and covered by tests. There is no UI to call it. Renaming is the most-requested tag management operation after delete and merge.

### Design

Rename is triggered by double-clicking a tag name in the table. The cell switches to an `<input>`. Pressing Enter or blurring the field commits; pressing Escape cancels and reverts to the original name.

**`src/app/EditableTagName.tsx`** — new, self-contained component

```
interface EditableTagNameProps {
  name: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
  existingNames: string[];   // for duplicate detection
}
```

Internal state: `editing: boolean`, `draft: string`.

When `editing`:
- Renders `<input>` with `autoFocus`, value bound to `draft`
- On `blur` or Enter: validates with `validateTagName(draft)` and checks for case-insensitive duplicate in `existingNames`
  - If invalid or duplicate: shows inline error, stays in edit mode
  - If valid and unique: calls `onRename(draft.trim())`
- On Escape: calls `onCancel()`, exits edit mode

When not editing:
- Renders the name in a `<span>` with `onDoubleClick={() => setEditing(true)}`
- A small pencil icon appears on hover (`:hover` via inline style + `onMouseEnter`/`onMouseLeave` state), improving discoverability

Duplicate-name warning message: _"A tag with this name already exists — use Merge instead."_

**`TagTable.tsx`** — minor change

The `name` column `renderCell` replaces the plain `{item.name}` span with `<EditableTagName>`. The column receives `onRename` and `existingNames` (all tag names) as new optional props. When `onRename` is absent the component falls back to the plain span (no behaviour change for callers that do not pass it).

**`TagManagerApp.tsx`** — adds `handleRename`

`original` is the tag's current name, looked up from `tags` by `tagId` before the async call begins.

```
const handleRename = useCallback(async (tagId: string, newName: string) => {
  const original = tags.find(t => t.id === tagId)?.name ?? tagId;
  const logId = appendLog(`Renaming "${original}" → "${newName}"…`, "running");
  try {
    const updated = await tagService.renameTagById(tagId, newName);
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, name: updated.name } : t));
    updateLog(logId, `✓ Renamed "${original}" → "${updated.name}"`, "success");
  } catch (e) {
    updateLog(logId, `✗ Failed to rename: ${sanitizeError(e)}`, "error");
    // EditableTagName reverts its local display via onCancel after the promise rejects
  }
}, [tags]);
```

`setTags` only runs on success (post-confirm update, not optimistic). On failure the activity log records the error and `EditableTagName` reverts its `draft` state via `onCancel`; the tag list in state is unchanged.

> **Cross-plan dependency:** `sanitizeError` is introduced in the Security Hardening plan (Plan 1). If Plan 3 is implemented independently, add a minimal inline implementation: `(e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200)`.

---

## Feature B — Text Search Filter

### Motivation

Alpha-nav requires knowing the first letter of a tag. A free-text search lets users find tags like `"payment-gateway"` or `"wontfix"` without scrolling.

### Design

**`src/app/SearchBar.tsx`** — new, minimal component

```
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

Renders a single `<input type="search">` styled with ADO CSS variables to match the existing palette. An "×" clear button appears when `value` is non-empty. No debounce — the tag list is filtered client-side over an already-loaded array, so filtering is synchronous and instant.

Placed above `AlphaNav` inside the `<Card>`.

**`TagManagerApp.tsx`** — adds `searchQuery` state

`filteredTags` changes from a single alpha-filter step to two composed steps:

```
const searchFiltered = searchQuery.trim()
  ? tags.filter(t => t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  : tags;

const filteredTags = alphaFilter
  ? searchFiltered.filter(t => { /* existing alpha logic */ })
  : searchFiltered;
```

When `searchQuery` changes, `currentPage` resets to 0.

**`AlphaNav`** receives `tags={searchFiltered}` instead of `tags={tags}` so disabled letters reflect the current search results, not the full list.

No service changes. No new dependencies.

---

## Feature C — Export Tags

### Motivation

Admins need a tag inventory for auditing, deduplication planning, or scripting external tooling.

### Design

**`src/utils/exportCsv.ts`** — pure utility, no dependencies

```
exportToCsv(tags: TagItem[], filename: string): void
```

Builds a CSV string with header row `id,name,workItems` and one row per tag. The `workItems` column is the tag's `count` if set, otherwise blank. Encodes the string as a `Blob`, creates a temporary `<a download>` element, clicks it, and revokes the object URL. No external libraries.

A companion `exportToJson(tags, filename)` function produces a pretty-printed JSON array. Both functions live in the same module.

**`TagManagerApp.tsx`** — adds Export command bar item

```
{
  id: "export",
  text: "Export",
  disabled: filteredTags.length === 0,
  onActivate: handleExportClick,
  important: false,
  subMenuProps: {
    items: [
      { id: "export-csv",  text: "Export as CSV",  onActivate: () => exportToCsv(filteredTags, "tags.csv") },
      { id: "export-json", text: "Export as JSON", onActivate: () => exportToJson(filteredTags, "tags.json") },
    ]
  }
}
```

The export reflects the current filtered view (alpha + search) so "Export B-tags" works naturally. If counts have been fetched for some tags they are included; otherwise the column is blank.

---

## Data Flow

```
User double-clicks tag name
  → EditableTagName enters edit mode (local state)
  → User types new name, presses Enter
  → validateTagName() → duplicate check
  → onRename(newName) → TagManagerApp.handleRename()
      → tagService.renameTagById(id, newName)
      → setTags (optimistic update)
      → updateLog (success or error)

User types in SearchBar
  → searchQuery state update
  → filteredTags recomputed (client-side, synchronous)
  → AlphaNav updated with search-scoped letter availability
  → currentPage reset to 0

User clicks Export > Export as CSV
  → exportToCsv(filteredTags, "tags.csv")
  → Blob created → <a download> triggered → file saved
```

---

## Error Handling

- **Rename:** `setTags` only runs on API success. On failure the activity log records the error and `EditableTagName` reverts its display via `onCancel`. No state rollback is needed because the list was never changed.
- **Search:** Client-side only; no error states needed.
- **Export:** Wrapped in a try/catch; if `Blob` or anchor creation fails (rare in modern browsers), a log entry is appended: `✗ Export failed: <sanitized error>`.

---

## Testing

| Test file | What it covers |
|-----------|---------------|
| `src/app/EditableTagName.test.tsx` | Renders name; double-click enters edit mode; Enter commits; Escape cancels; invalid name shows error; duplicate name shows merge hint |
| `src/app/TagManagerApp.rename.test.tsx` | Rename success updates tag in list and log; API failure shows error log; duplicate detection prevents commit |
| `src/app/SearchBar.test.tsx` | Typing filters tag list; clear button resets query; empty query shows all tags |
| `src/app/TagManagerApp.search.test.tsx` | Search + alpha filter compose correctly; page resets on search change |
| `src/utils/exportCsv.test.ts` | CSV output matches snapshot for known tag list (with and without counts); JSON output is valid; filename passed to anchor |

---

## Files Created / Modified

| Action | File |
|--------|------|
| Create | `src/app/EditableTagName.tsx` |
| Create | `src/app/EditableTagName.test.tsx` |
| Create | `src/app/SearchBar.tsx` |
| Create | `src/app/SearchBar.test.tsx` |
| Create | `src/utils/exportCsv.ts` |
| Create | `src/utils/exportCsv.test.ts` |
| Create | `src/app/TagManagerApp.rename.test.tsx` |
| Create | `src/app/TagManagerApp.search.test.tsx` |
| Modify | `src/app/TagTable.tsx` — use `EditableTagName` in name cell |
| Modify | `src/app/TagManagerApp.tsx` — add `handleRename`, `searchQuery` state, Export command bar item |

---

## Out of Scope

- Undo / undo history for rename
- Rename via right-click context menu
- Import tags from CSV (inverse of export)
- Tag colour or metadata fields (not supported by the ADO Tags API)
