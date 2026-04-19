# UI Improvements Design — Tag Manager Hub

**Date:** 2026-04-19  
**Scope:** Four targeted changes to improve readability and ADO design language compliance. No logic changes.

---

## Goals

- Replace custom-styled HTML elements with ADO UI library components throughout the hub.
- Eliminate inline `style={{}}` props, centralising all styles in a single CSS file.
- Align command bar affordances with Azure DevOps tooling conventions (icon + label pairs).

---

## Changes

### A — AlphaNav: Replace custom buttons with ADO `TabBar` + `Tab`

**File:** `src/app/AlphaNav.tsx`

Replace the 28 hand-rolled `<button>` elements with an ADO `TabBar` containing one `Tab` per letter plus "All". 

- Import `TabBar`, `Tab`, `TabSize` from `azure-devops-ui/Tabs`.
- The `TabBar` receives `selectedTabId` (the active filter, or `"all"` when none) and `onSelectedTabChanged` which calls the existing `onFilter` prop.
- Each `Tab` has `id` set to the letter (`"#"`, `"A"`…`"Z"`) and `name` set to the same string.
- Tabs for letters with no matching tags receive `disabled={true}` — ADO renders them muted automatically.
- Use `TabSize.Compact` to keep vertical footprint equivalent to the current bar.
- Remove all inline `style` props from this component; move layout rules to `.tm-alpha-nav` in `tag-manager.css`.

The `alphaFilter` state in `TagManagerApp` maps directly: `null` → `selectedTabId="all"`, letter → `selectedTabId=letter`. The `onSelectedTabChanged` callback receives the new tab id and calls `handleAlphaFilter(id === "all" ? null : id)`.

---

### B — Pagination: Replace raw `<button>` with ADO `Button` (subtle) inside `ButtonGroup`

**File:** `src/app/TagManagerApp.tsx`

The pagination block in `TagManagerApp` uses raw `<button>` elements with extensive inline styles. Replace with ADO components:

- Import `Button` from `azure-devops-ui/Button` and `ButtonGroup` from `azure-devops-ui/ButtonGroup`.
- Render a `ButtonGroup` containing two `Button` components: Previous and Next.
- Both buttons use the `subtle` boolean prop (`subtle={true}`).
- Previous button: `iconProps={{ iconName: "ChevronLeft" }}`, disabled when `safePage === 0`.
- Next button: `iconProps={{ iconName: "ChevronRight" }}`, disabled when `safePage >= totalPages - 1`.
- The page count label (`Page X of Y (N tags)`) stays as a plain `<span>` between the label text and the `ButtonGroup` — no ADO component needed here.
- Move the pagination wrapper's layout styles (flex, border-top, padding) to `.tm-pagination` in `tag-manager.css`.

---

### C — Command Bar: Add `iconProps` to Delete, Merge, Count

**File:** `src/app/TagManagerApp.tsx`

The `commandBarItems` array already uses `IHeaderCommandBarItem`. Add `iconProps` to each entry:

| Action | `iconName` |
|--------|-----------|
| Delete | `"Trash"` |
| Merge  | `"Merge"` |
| Count  | `"NumberSymbol"` |

No other changes to the command bar — disabled state, selection count suffix, and `onActivate` handlers are unchanged.

---

### F — CSS File: Extract inline styles to `src/app/tag-manager.css`

**New file:** `src/app/tag-manager.css`

All inline `style={{}}` props across `AlphaNav.tsx`, `TagManagerApp.tsx`, and `StatusLog.tsx` are extracted to named CSS classes. ADO CSS custom property tokens already referenced in the inline styles (`var(--palette-neutral-10)`, `var(--communication-foreground)`, etc.) are preserved verbatim.

CSS class naming convention: `tm-` prefix for all classes (Tag Manager).

| Class | Source component | Purpose |
|-------|-----------------|---------|
| `.tm-alpha-nav` | `AlphaNav` | Wrapper flex layout |
| `.tm-pagination` | `TagManagerApp` | Pagination row flex + border |
| `.tm-status-log` | `StatusLog` | Border-top, font, margin |
| `.tm-status-log__header` | `StatusLog` | Toggle row flex + cursor |
| `.tm-status-log__body` | `StatusLog` | Max-height, overflow-y |
| `.tm-status-log__entry` | `StatusLog` | Row flex + padding |
| `.tm-status-log__timestamp` | `StatusLog` | Min-width + muted colour |
| `.tm-status-log__icon` | `StatusLog` | Min-width |
| `.tm-error-card` | `TagManagerApp` | Error MessageCard margin |
| `.tm-spinner-wrapper` | `TagManagerApp` | Loading spinner centering |

`tag-manager.css` is imported once at the top of `TagManagerApp.tsx`. No global styles — all classes are component-scoped by the `tm-` prefix.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/AlphaNav.tsx` | Rewrite render: custom buttons → `TabBar` + `Tab` |
| `src/app/TagManagerApp.tsx` | Pagination buttons → `Button`/`ButtonGroup`; add icon props; import CSS |
| `src/app/StatusLog.tsx` | Replace inline styles with `tm-` CSS classes |
| `src/app/tag-manager.css` | New file — all extracted styles |

`TagTable.tsx`, `DeleteDialog.tsx`, `MergeDialog.tsx`, `CountConfirmDialog.tsx`, and all service/type files are untouched.

---

## Testing

- All existing unit tests in `TagManagerApp.test.tsx`, `AlphaNav` (if present), and `StatusLog.test.tsx` must continue to pass unchanged — no logic is modified.
- Manual smoke test: load the hub, verify tab strip renders, click a letter to filter, click All to reset, page through results, select tags and confirm icons appear on command bar buttons.
- Verify disabled tabs (letters with no tags) are visually muted and not clickable.
- Verify Previous/Next buttons disable correctly at first/last page.
