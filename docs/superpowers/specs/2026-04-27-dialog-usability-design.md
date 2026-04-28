# Dialog Usability Improvements — Design Spec

**Date:** 2026-04-27  
**Status:** Approved

## Context

Two usability issues were identified in the tag manager dialogs:

1. The Merge button appears to the right of Delete in the command bar, but convention (and user preference) places the less-destructive action first.
2. Both the Delete Tags and Merge Tags dialogs lack visual weight — tag names render as plain small text that blends into the dark background, making it hard to parse what's affected. In the Merge dialog, the target tag autocomplete uses a floating dropdown that clips at the dialog boundary and requires unexpected scrolling.

## Change 1 — Button Order

**File:** `src/app/TagManagerApp.tsx` (lines ~214–233)

Swap the order of entries in the `commandBarItems` array so `merge` appears before `delete`. No other change needed — the `IHeaderCommandBarItem` array drives rendering order directly.

**Before:** Delete | Merge  
**After:** Merge | Delete

## Change 2 — Tag Pill Styling (both dialogs)

**Files:** `src/app/DeleteDialog.tsx`, `src/app/MergeDialog.tsx`

Replace the bordered table-style tag list with rows of `Pill` components from `azure-devops-ui/Pill`.

### Implementation
- Add imports: `import { Pill, PillSize, PillVariant } from "azure-devops-ui/Pill";`
- Remove the existing `<div>` list with the "Tag" column header and plain-text rows.
- Above the pills, render a section label: `"{n} tag{s} will be deleted"` / `"{n} tag{s} will be merged"`.
- Each tag renders as:
  ```tsx
  <Pill
    size={PillSize.regular}
    variant={PillVariant.outlined}
    iconProps={{ iconName: "Tag" }}
  >
    {t.name}
  </Pill>
  ```
- Wrap all pills in a `<div>` with `display: flex; flexWrap: wrap; gap: 6px; margin: 8px 0 16px`.
- Do **not** pass a custom `color` prop — `PillVariant.outlined` inherits its border and text color from the azure-devops-ui theme automatically, so it will be correct in both light and dark mode.

### Section label style
`fontSize: "11px"`, `fontWeight: 600`, `textTransform: "uppercase"`, `letterSpacing: "0.5px"`, `color: "var(--palette-neutral-60, #666)"` — matches the existing column-header style already in both files.

## Change 3 — Merge Target Selector (MergeDialog only)

**File:** `src/app/MergeDialog.tsx`

Replace the floating autocomplete dropdown with a fixed in-body list.

### Layout
```
[ search input — full width, top of the list container ]
┌─────────────────────────────────────────┐
│  as-built     ← highlighted row         │  fixed height: 160px
│  assets                                 │  overflow-y: auto
│  assign                                 │  border: 1px solid var(--palette-neutral-20)
│  assessment                             │  border-top: none on list, input handles top border
│  async                                  │
├─────────────────────────────────────────┤
│  "my-tag"  [Create new]                 │  ← last row, only when isNewTag
└─────────────────────────────────────────┘
```

### Input styling
Use the same border and background as the current input, but set `borderRadius: "2px 2px 0 0"` so it visually connects to the list below.

### List rows
Each existing-tag row contains a `Pill` (same props as Change 2) rendered inline, making the target list visually consistent with the source list above it. Row padding: `6px 10px`. The highlighted row uses `background: "var(--palette-neutral-8, #e8e8e8)"` (standard azure-devops-ui hover token).

### "Create new" row
Same styling as the current dropdown's "Create new" entry — the typed value in `var(--communication-foreground)` blue, followed by the existing `Create new` badge span. Pinned as the last item in the list when `isNewTag` is true.

### Behaviour
- The list is always visible once the `FormItem` is rendered (not a popover/portal).
- **Empty state:** when the input is empty, show all available non-source tags. Filter to names containing the typed string as the user types.
- **Source tags excluded:** add `&& !sources.some(s => s.id === t.id)` to the suggestions filter. The current code does not exclude them — this is a bug fix bundled into this change.
- Keyboard navigation (↑/↓/Enter/Escape) retained from existing `handleKeyDown` logic; remove the `if (!showSuggestions || totalItems === 0) return` guard — the list is always visible so nav should always respond.
- Selecting an existing row calls `selectSuggestion(name)` as before.
- Selecting "Create new" keeps the typed value as the target name (no state change needed beyond closing the suggestion focus).

### State/code to remove
`showSuggestions`, `setShowSuggestions`, `containerRef`, the click-outside `useEffect`, the `onFocus` handler on the input, and the `{!showSuggestions && isNewTag && ...}` "New tag" badge block — none are needed with the always-visible list.

### Fixed list height
`maxHeight: 160px`, `overflowY: "auto"`. Accommodates ~5 items before scrolling, keeping the dialog a reasonable size.

## Files Changed

| File | Change |
|------|--------|
| `src/app/TagManagerApp.tsx` | Swap merge/delete order in `commandBarItems` |
| `src/app/DeleteDialog.tsx` | Replace flat tag list with `Pill` components + count label |
| `src/app/MergeDialog.tsx` | Same `Pill` treatment for source tags + replace floating dropdown with fixed inline list |

## New Imports Required

| File | Import |
|------|--------|
| `src/app/DeleteDialog.tsx` | `import { Pill, PillSize, PillVariant } from "azure-devops-ui/Pill";` |
| `src/app/MergeDialog.tsx` | `import { Pill, PillSize, PillVariant } from "azure-devops-ui/Pill";` |

## Verification

1. Select 2–3 tags in the tag manager grid.
2. Open Delete dialog — confirm `Pill` components render with the theme's outlined style and the "Tag" icon. Confirm the count label reads correctly. Confirm Cancel and Delete buttons work.
3. Open Merge dialog — confirm source tags show as pills. Open with no text typed and confirm the fixed list shows all non-source tags. Type in the search field and confirm live filtering. Select an existing tag row and confirm the Merge button enables. Type a new name not matching any tag and confirm the "Create new" row appears at the bottom. Confirm Merge executes correctly.
4. Confirm button bar shows Merge to the left of Delete.
5. Verify no regression: single-tag selection, zero-tag disabled state, keyboard ↑/↓/Enter nav in the merge list.
6. Verify both light theme and dark theme — pills should adapt automatically via `PillVariant.outlined`.
