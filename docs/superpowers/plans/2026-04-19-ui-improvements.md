# UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom-styled HTML elements in the Tag Manager hub with ADO UI library components, and extract all inline styles to a single CSS file.

**Architecture:** Four tasks in sequence-then-parallel: Task 1 (mock prep) runs on `dev` first; Tasks 2 and 3 branch off `dev` and run in parallel (different files); Task 4 branches off `dev` after both are merged and handles CSS extraction.

**Tech Stack:** React, TypeScript, `azure-devops-ui` (TabBar/Tab, Button, ButtonGroup), Jest + Testing Library, identity-obj-proxy for CSS in tests.

---

## Branching Strategy

```
dev
├── Task 1: extend mock (commit directly to dev — 1 file, no conflict risk)
├── ui/alphanav-tabbar    (Task 2, branches from dev after Task 1)
├── ui/pagination-icons   (Task 3, branches from dev after Task 1)
└── ui/css-extraction     (Task 4, branches from dev after Tasks 2+3 merged)
```

Tasks 2 and 3 touch entirely different files and can be dispatched as parallel subagents.

---

## File Map

| File | Task | Change |
|------|------|--------|
| `src/test/mocks/modules/azureDevopsUi.tsx` | 1 | Add TabBar, Tab, TabSize, Button, ButtonGroup mock exports |
| `src/app/AlphaNav.tsx` | 2 | Full rewrite: custom buttons → TabBar + Tab |
| `src/app/AlphaNav.test.tsx` | 2 | New file — rendering and interaction tests |
| `src/app/TagManagerApp.tsx` | 3 | Pagination → Button/ButtonGroup; add iconProps to command bar |
| `src/app/tag-manager.css` | 4 | New file — all extracted styles with tm- prefix |
| `src/app/TagManagerApp.tsx` | 4 | Replace inline styles with tm- CSS classes; import CSS |
| `src/app/StatusLog.tsx` | 4 | Replace inline styles with tm- CSS classes |

---

## Task 1: Extend ADO UI mock (commit directly to `dev`)

**Files:**
- Modify: `src/test/mocks/modules/azureDevopsUi.tsx`

- [ ] **Step 1: Add TabBar, Tab, TabSize, Button, and ButtonGroup exports to the mock**

Open `src/test/mocks/modules/azureDevopsUi.tsx` and append the following before the final closing of the file:

```tsx
// ---- Tabs ----
const TabBarContext = React.createContext<(id: string) => void>(() => {});

export const TabSize = {
  Compact: "compact",
  Tall: "tall",
  LargeLink: "large-link",
};

export const TabBar: React.FC<{
  selectedTabId?: string;
  onSelectedTabChanged: (tabId: string) => void;
  tabSize?: string;
  children?: React.ReactNode;
}> = ({ children, onSelectedTabChanged }) => (
  <TabBarContext.Provider value={onSelectedTabChanged}>
    <div data-testid="ado-tab-bar">{children}</div>
  </TabBarContext.Provider>
);

export const Tab: React.FC<{
  id: string;
  name?: string;
}> = ({ id, name }) => {
  const onTabChanged = React.useContext(TabBarContext);
  return (
    <button data-testid={`ado-tab-${id}`} onClick={() => onTabChanged(id)}>
      {name}
    </button>
  );
};

// ---- Button / ButtonGroup ----
export const Button: React.FC<{
  text?: string;
  subtle?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  iconProps?: { iconName: string };
}> = ({ text, disabled, onClick }) => (
  <button disabled={disabled} onClick={onClick}>
    {text}
  </button>
);

export const ButtonGroup: React.FC<React.PropsWithChildren<unknown>> = ({
  children,
}) => <div data-testid="ado-button-group">{children}</div>;
```

- [ ] **Step 2: Run all tests to confirm they still pass before branching**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass (no new failures introduced by mock additions).

- [ ] **Step 3: Commit**

```bash
git add src/test/mocks/modules/azureDevopsUi.tsx
git commit -m "test: add TabBar, Tab, Button, ButtonGroup exports to ADO UI mock"
```

---

## Task 2: AlphaNav → TabBar + Tab (branch: `ui/alphanav-tabbar`)

> Branch from `dev` **after Task 1 is committed**.

**Files:**
- Modify: `src/app/AlphaNav.tsx`
- Create: `src/app/AlphaNav.test.tsx`

- [ ] **Step 1: Create branch**

```bash
git checkout -b ui/alphanav-tabbar dev
```

- [ ] **Step 2: Write failing tests for AlphaNav**

Create `src/app/AlphaNav.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlphaNav } from "./AlphaNav";

const tags = [
  { id: "1", name: "alpha", url: "" },
  { id: "2", name: "beta", url: "" },
  { id: "3", name: "gamma", url: "" },
  { id: "4", name: "42-sprint", url: "" },
];

describe("AlphaNav", () => {
  it("renders the All tab and only tabs for letters that have tags", () => {
    render(<AlphaNav tags={tags} activeFilter={null} onFilter={() => {}} />);

    expect(screen.getByTestId("ado-tab-all")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-A")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-B")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-G")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-#")).toBeInTheDocument();
    expect(screen.queryByTestId("ado-tab-C")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ado-tab-Z")).not.toBeInTheDocument();
  });

  it("calls onFilter(null) when the All tab is clicked", async () => {
    const onFilter = jest.fn();
    render(<AlphaNav tags={tags} activeFilter="A" onFilter={onFilter} />);

    await userEvent.click(screen.getByTestId("ado-tab-all"));

    expect(onFilter).toHaveBeenCalledWith(null);
  });

  it("calls onFilter with the letter when a letter tab is clicked", async () => {
    const onFilter = jest.fn();
    render(<AlphaNav tags={tags} activeFilter={null} onFilter={onFilter} />);

    await userEvent.click(screen.getByTestId("ado-tab-A"));

    expect(onFilter).toHaveBeenCalledWith("A");
  });

  it("calls onFilter('#') when the hash tab is clicked", async () => {
    const onFilter = jest.fn();
    render(<AlphaNav tags={tags} activeFilter={null} onFilter={onFilter} />);

    await userEvent.click(screen.getByTestId("ado-tab-#"));

    expect(onFilter).toHaveBeenCalledWith("#");
  });

  it("renders a tab for # when tags start with non-alpha characters", () => {
    const numericTags = [{ id: "1", name: "123-sprint", url: "" }];
    render(<AlphaNav tags={numericTags} activeFilter={null} onFilter={() => {}} />);

    expect(screen.getByTestId("ado-tab-#")).toBeInTheDocument();
    expect(screen.queryByTestId("ado-tab-A")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest src/app/AlphaNav.test.tsx --no-coverage
```

Expected: FAIL — `ado-tab-all` not found because AlphaNav still renders plain `<button>` elements.

- [ ] **Step 4: Rewrite AlphaNav.tsx**

Replace the entire contents of `src/app/AlphaNav.tsx`:

```tsx
import React from "react";
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs";
import { TagItem } from "../types";

interface AlphaNavProps {
  tags: TagItem[];
  activeFilter: string | null;
  onFilter: (letter: string | null) => void;
}

const LETTERS = ["#", ...Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
)];

export const AlphaNav: React.FC<AlphaNavProps> = ({ tags, activeFilter, onFilter }) => {
  const available = new Set(
    tags.map((t) => {
      const ch = t.name[0]?.toUpperCase();
      return ch && ch >= "A" && ch <= "Z" ? ch : "#";
    })
  );
  const availableLetters = LETTERS.filter((l) => available.has(l));

  return (
    <TabBar
      selectedTabId={activeFilter ?? "all"}
      onSelectedTabChanged={(id) => onFilter(id === "all" ? null : id)}
      tabSize={TabSize.Compact}
    >
      <Tab id="all" name="All" />
      {availableLetters.map((letter) => (
        <Tab key={letter} id={letter} name={letter} />
      ))}
    </TabBar>
  );
};
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/app/AlphaNav.test.tsx src/app/TagManagerApp.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/AlphaNav.tsx src/app/AlphaNav.test.tsx
git commit -m "feat: replace AlphaNav custom buttons with ADO TabBar + Tab"
```

---

## Task 3: Pagination + Command Bar Icons (branch: `ui/pagination-icons`)

> Branch from `dev` **after Task 1 is committed**. Runs in parallel with Task 2.

**Files:**
- Modify: `src/app/TagManagerApp.tsx`

- [ ] **Step 1: Create branch**

```bash
git checkout -b ui/pagination-icons dev
```

- [ ] **Step 2: Write a failing test for the pagination buttons**

Add this test to `src/app/TagManagerApp.test.tsx` inside the existing `describe("TagManagerApp")` block, after the existing tests:

```tsx
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
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npx jest src/app/TagManagerApp.test.tsx --no-coverage
```

Expected: FAIL on the new test — no buttons named "Previous" or "Next" exist yet.

- [ ] **Step 4: Update TagManagerApp.tsx — add imports**

At the top of `src/app/TagManagerApp.tsx`, add two new imports after the existing ADO UI imports:

```tsx
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";
```

- [ ] **Step 5: Update TagManagerApp.tsx — replace pagination block**

Find and replace the raw `<button>` pagination block (the `{!loading && totalPages > 1 && (...)}` section, currently lines ~310–352). Replace it with:

```tsx
{!loading && totalPages > 1 && (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "12px",
      padding: "8px 4px 4px",
      borderTop: "1px solid var(--palette-neutral-10, #e0e0e0)",
      marginTop: "4px",
      fontSize: "13px",
      color: "var(--palette-neutral-60, #555)",
    }}
  >
    <span>
      Page {safePage + 1} of {totalPages}
      {" "}({filteredTags.length} tag{filteredTags.length !== 1 ? "s" : ""})
    </span>
    <ButtonGroup>
      <Button
        subtle={true}
        text="Previous"
        iconProps={{ iconName: "ChevronLeft" }}
        disabled={safePage === 0}
        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
      />
      <Button
        subtle={true}
        text="Next"
        iconProps={{ iconName: "ChevronRight" }}
        disabled={safePage >= totalPages - 1}
        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
      />
    </ButtonGroup>
  </div>
)}
```

Note: the wrapper div keeps its inline styles for now — Task 4 will extract them to CSS.

- [ ] **Step 6: Update TagManagerApp.tsx — add iconProps to command bar items**

Find the `commandBarItems` array (currently lines ~249–271). Replace it with:

```tsx
const commandBarItems: IHeaderCommandBarItem[] = [
  {
    id: "delete",
    text: `Delete${sel}`,
    iconProps: { iconName: "Trash" },
    disabled: n === 0,
    onActivate: handleDeleteClick,
    important: true,
  },
  {
    id: "merge",
    text: `Merge${sel}`,
    iconProps: { iconName: "Merge" },
    disabled: n === 0,
    onActivate: handleMergeClick,
    important: true,
  },
  {
    id: "count",
    text: `Count${sel}`,
    iconProps: { iconName: "NumberSymbol" },
    disabled: n === 0,
    onActivate: handleCountClick,
    important: true,
  },
];
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npx jest src/app/TagManagerApp.test.tsx --no-coverage
```

Expected: all tests pass including the new pagination test.

- [ ] **Step 8: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/app/TagManagerApp.tsx
git commit -m "feat: replace pagination buttons with ADO Button/ButtonGroup; add icons to command bar"
```

---

## Merge Tasks 2 and 3 into `dev`

> Complete this before starting Task 4. Merge both parallel branches.

- [ ] **Step 1: Merge Task 2 branch**

```bash
git checkout dev
git merge --no-ff ui/alphanav-tabbar -m "merge: AlphaNav TabBar + Tab"
```

- [ ] **Step 2: Merge Task 3 branch**

```bash
git merge --no-ff ui/pagination-icons -m "merge: pagination Button/ButtonGroup + command bar icons"
```

These two branches touch different files (`AlphaNav.tsx` vs `TagManagerApp.tsx`) — no merge conflict expected.

- [ ] **Step 3: Run full test suite on dev after merges**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

---

## Task 4: CSS Extraction (branch: `ui/css-extraction`)

> Branch from `dev` **after both Task 2 and Task 3 are merged**.

**Files:**
- Create: `src/app/tag-manager.css`
- Modify: `src/app/TagManagerApp.tsx`
- Modify: `src/app/StatusLog.tsx`

- [ ] **Step 1: Create branch**

```bash
git checkout -b ui/css-extraction dev
```

- [ ] **Step 2: Run existing tests to establish baseline**

```bash
npx jest --no-coverage
```

Expected: all tests pass. This is your baseline — if tests fail after CSS changes, you introduced a bug.

- [ ] **Step 3: Create src/app/tag-manager.css**

```css
/* ============================================================
   Tag Manager — component styles
   All ADO CSS tokens (var(--palette-*)) are from azure-devops-ui.
   ============================================================ */

/* Pagination row */
.tm-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 8px 4px 4px;
  border-top: 1px solid var(--palette-neutral-10, #e0e0e0);
  margin-top: 4px;
  font-size: 13px;
  color: var(--palette-neutral-60, #555);
}

/* Loading spinner centering */
.tm-spinner-wrapper {
  display: flex;
  justify-content: center;
  padding: 32px;
}

/* Card inner flex-column layout */
.tm-card-content {
  display: flex;
  flex-direction: column;
}

/* Activity log — container */
.tm-status-log {
  border-top: 1px solid var(--palette-neutral-10, #eee);
  margin-top: 16px;
  font-family: monospace;
  font-size: 12px;
}

/* Activity log — collapse/expand header row */
.tm-status-log__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
  user-select: none;
  color: var(--palette-neutral-60, #555);
}

/* Activity log — scrollable body */
.tm-status-log__body {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px 0;
}

/* Activity log — single log entry row */
.tm-status-log__entry {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}

/* Activity log — timestamp column */
.tm-status-log__timestamp {
  min-width: 60px;
  color: var(--palette-neutral-30, #aaa);
}

/* Activity log — status icon column */
.tm-status-log__icon {
  min-width: 16px;
}
```

- [ ] **Step 4: Update TagManagerApp.tsx — import CSS and replace inline styles**

At the top of `src/app/TagManagerApp.tsx`, add the CSS import after the last existing import line:

```tsx
import "./tag-manager.css";
```

Then make three inline-style replacements in the JSX:

**4a.** Find the card content wrapper div:
```tsx
<div style={{ display: "flex", flexDirection: "column" }}>
```
Replace with:
```tsx
<div className="tm-card-content">
```

**4b.** Find the spinner wrapper div:
```tsx
<div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
```
Replace with:
```tsx
<div className="tm-spinner-wrapper">
```

**4c.** Find the pagination wrapper div (the one with the long inline style object containing `borderTop`, `marginTop`, `fontSize`, etc.):
```tsx
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "8px 4px 4px",
    borderTop: "1px solid var(--palette-neutral-10, #e0e0e0)",
    marginTop: "4px",
    fontSize: "13px",
    color: "var(--palette-neutral-60, #555)",
  }}
>
```
Replace with:
```tsx
<div className="tm-pagination">
```

- [ ] **Step 5: Update StatusLog.tsx — replace all inline styles with CSS classes**

Replace the entire contents of `src/app/StatusLog.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import { LogEntry } from "../types";

interface StatusLogProps {
  entries: LogEntry[];
}

const STATUS_ICONS: Record<LogEntry["status"], string> = {
  info: "ℹ",
  success: "✓",
  error: "✗",
  running: "…",
};

const STATUS_COLORS: Record<LogEntry["status"], string> = {
  info: "var(--palette-neutral-60, #555)",
  success: "var(--communication-foreground, #0078d4)",
  error: "var(--status-error-foreground, #c4314b)",
  running: "var(--palette-neutral-60, #555)",
};

export const StatusLog: React.FC<StatusLogProps> = ({ entries }) => {
  const [collapsed, setCollapsed] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && entries.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, collapsed]);

  if (entries.length === 0) return null;

  return (
    <div className="tm-status-log">
      <div
        className="tm-status-log__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>{collapsed ? "▶" : "▼"}</span>
        <span>
          Activity Log ({entries.length} entr{entries.length !== 1 ? "ies" : "y"})
        </span>
      </div>

      {!collapsed && (
        <div className="tm-status-log__body">
          {entries.map((e) => (
            <div
              key={e.id}
              className="tm-status-log__entry"
              style={{ color: STATUS_COLORS[e.status] }}
            >
              <span className="tm-status-log__timestamp">
                {e.timestamp.toLocaleTimeString()}
              </span>
              <span className="tm-status-log__icon">{STATUS_ICONS[e.status]}</span>
              <span>{e.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
```

Note: `style={{ color: STATUS_COLORS[e.status] }}` stays inline on the entry div because it is dynamic (changes per log entry status).

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass. The `identity-obj-proxy` mock returns class name strings unchanged, so `className="tm-pagination"` renders correctly in tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/tag-manager.css src/app/TagManagerApp.tsx src/app/StatusLog.tsx
git commit -m "refactor: extract inline styles to tag-manager.css with tm- CSS classes"
```

- [ ] **Step 8: Merge into dev**

```bash
git checkout dev
git merge --no-ff ui/css-extraction -m "merge: CSS extraction to tag-manager.css"
```

- [ ] **Step 9: Final test run on dev**

```bash
npx jest --no-coverage
```

Expected: all tests pass.
