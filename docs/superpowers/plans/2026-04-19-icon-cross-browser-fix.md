# Icon Cross-Browser Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix icon rendering so Delete, Merge, and Count buttons show correct icons, and table selection checkboxes render consistently in both Firefox and Edge.

**Architecture:** Two bugs are present. First, `initializeIconSupport.ts` never adds `fluent-icons-enabled` to `document.body` — all Fluent icon CSS selectors require this class, so Firefox works (parent ADO frame injects it via SDK) but Edge does not. Second, the icon names `"Trash"` and `"Merge"` do not exist in the icon CSS; the correct names are `"Delete"` and `"BranchMerge"`.

**Tech Stack:** React, azure-devops-ui v2.271.0, FluentIcons.css (WOFF2 font loaded under `.fluent-icons-enabled`), Jest/Testing Library

---

## File Map

| File | Change |
|------|--------|
| `src/app/icons/initializeIconSupport.ts` | Add `document.body.classList.add("fluent-icons-enabled")` |
| `src/app/TagManagerApp.tsx` | Fix `"Trash"` → `"Delete"`, `"Merge"` → `"BranchMerge"` |

---

### Task 1: Test that `initializeIconSupport` adds the `fluent-icons-enabled` class

**Files:**
- Modify: `src/app/icons/initializeIconSupport.ts` (new behavior)
- Create: `src/app/icons/initializeIconSupport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/icons/initializeIconSupport.test.ts`:

```typescript
import { initializeIconSupport } from "./initializeIconSupport";

describe("initializeIconSupport", () => {
  beforeEach(() => {
    document.body.classList.remove("fluent-icons-enabled");
    jest.resetModules();
  });

  it("adds fluent-icons-enabled class to document.body", () => {
    initializeIconSupport();
    expect(document.body.classList.contains("fluent-icons-enabled")).toBe(true);
  });

  it("is idempotent — calling twice does not throw", () => {
    expect(() => {
      initializeIconSupport();
      initializeIconSupport();
    }).not.toThrow();
    expect(document.body.classList.contains("fluent-icons-enabled")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/app/icons/initializeIconSupport.test.ts --no-coverage`

Expected: FAIL — `"fluent-icons-enabled"` class is not added by the current implementation.

- [ ] **Step 3: Implement the fix in `initializeIconSupport.ts`**

Replace the entire file content:

```typescript
import "azure-devops-ui/Components/Icon/Icon";

let initialized = false;

export function initializeIconSupport(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  document.body.classList.add("fluent-icons-enabled");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/app/icons/initializeIconSupport.test.ts --no-coverage`

Expected: PASS — both assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/app/icons/initializeIconSupport.ts src/app/icons/initializeIconSupport.test.ts
git commit -m "fix: add fluent-icons-enabled class for cross-browser icon rendering"
```

---

### Task 2: Fix wrong icon names for Delete and Merge buttons

**Files:**
- Modify: `src/app/TagManagerApp.tsx` (lines 292 and 300)

The icon names `"Trash"` and `"Merge"` do not exist in FluentIcons.css or FabricIcons.css. The CSS only defines `.ms-Icon--Delete` and `.ms-Icon--BranchMerge`.

- [ ] **Step 1: Write a test asserting correct icon names are used**

In `src/app/TagManagerApp.test.tsx`, add a test in the existing describe block (after existing imports/setup):

```typescript
it("uses correct icon names for Delete, Merge, and Count command bar items", () => {
  // Render with some tags so buttons are not disabled (count > 0)
  // Check via the rendered aria-label or icon class that correct icons appear.
  // Since azure-devops-ui renders icon spans with class ms-Icon--<Name>,
  // verify by inspecting the rendered DOM.
  const { container } = render(<TagManagerApp />);
  // With 0 tags selected, buttons are disabled — icons still render in the DOM.
  // The Fluent icon spans carry data-icon-name attribute in azure-devops-ui.
  // We verify the iconProps by checking rendered output contains correct class names.
  // Note: azure-devops-ui renders <span class="fabric-icon ms-Icon ms-Icon--Delete ...">
  expect(container.querySelector(".ms-Icon--Delete")).not.toBeNull();
  expect(container.querySelector(".ms-Icon--BranchMerge")).not.toBeNull();
  expect(container.querySelector(".ms-Icon--NumberSymbol")).not.toBeNull();
  expect(container.querySelector(".ms-Icon--Trash")).toBeNull();
  expect(container.querySelector(".ms-Icon--Merge")).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/app/TagManagerApp.test.tsx --no-coverage -t "uses correct icon names"`

Expected: FAIL — finds `.ms-Icon--Trash` and `.ms-Icon--Merge`, does not find `.ms-Icon--Delete` or `.ms-Icon--BranchMerge`.

- [ ] **Step 3: Fix the icon names in `TagManagerApp.tsx`**

In [TagManagerApp.tsx:292](src/app/TagManagerApp.tsx#L292), change `"Trash"` → `"Delete"`:

```typescript
    {
      id: "delete",
      text: `Delete${sel}`,
      iconProps: { iconName: "Delete" },
      disabled: n === 0,
      onActivate: handleDeleteClick,
      important: true,
    },
```

In [TagManagerApp.tsx:300](src/app/TagManagerApp.tsx#L300), change `"Merge"` → `"BranchMerge"`:

```typescript
    {
      id: "merge",
      text: `Merge${sel}`,
      iconProps: { iconName: "BranchMerge" },
      disabled: n === 0,
      onActivate: handleMergeClick,
      important: true,
    },
```

(`"NumberSymbol"` on line 308 is already correct — no change needed.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/app/TagManagerApp.test.tsx --no-coverage -t "uses correct icon names"`

Expected: PASS.

- [ ] **Step 5: Run the full test suite to catch regressions**

Run: `pnpm test --no-coverage`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/TagManagerApp.tsx src/app/TagManagerApp.test.tsx
git commit -m "fix: correct icon names for Delete (was Trash) and Merge (was BranchMerge)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Icons for Delete button — Task 2 fixes `"Trash"` → `"Delete"`, Task 1 ensures font activates
- ✅ Icons for Merge button — Task 2 fixes `"Merge"` → `"BranchMerge"`, Task 1 ensures font activates
- ✅ Icons for Count button — `"NumberSymbol"` was correct; Task 1 ensures font activates in Edge
- ✅ Table selection icons (checkboxes) — Checkbox uses azure-devops-ui's own icon rendering, also gated on `fluent-icons-enabled`; Task 1 fixes this
- ✅ Cross-browser (Firefox + Edge) — root cause addressed in Task 1

**Placeholder scan:** None — all code blocks contain actual implementation.

**Type consistency:** No type changes — only string literal values and a `classList` call.
