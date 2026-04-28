# Dialog Usability Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap Merge/Delete button order, replace flat tag lists with azure-devops-ui `Pill` components in both dialogs, and replace the floating autocomplete dropdown in MergeDialog with an always-visible inline list.

**Architecture:** Three self-contained file changes — TagManagerApp.tsx (array order), DeleteDialog.tsx (list → pills), MergeDialog.tsx (pills + dropdown → fixed list). All azure-devops-ui imports are redirected in tests to `src/test/mocks/modules/azureDevopsUi.tsx`, so the Pill mock must be added there before any component changes.

**Tech Stack:** React, TypeScript, azure-devops-ui v2.272.0, Jest + @testing-library/react

---

## File Map

| File | Change |
|------|--------|
| `src/test/mocks/modules/azureDevopsUi.tsx` | Add `Pill`, `PillSize`, `PillVariant` mock exports |
| `src/app/TagManagerApp.tsx` | Swap `merge`/`delete` order in `commandBarItems` |
| `src/app/DeleteDialog.tsx` | Replace flat list with pills + count label; remove unused `Icon` import |
| `src/app/MergeDialog.tsx` | Pills for source list; fixed inline target list; remove dropdown/showSuggestions |

---

## Task 1: Add Pill mock to the azure-devops-ui test mock

**Files:**
- Modify: `src/test/mocks/modules/azureDevopsUi.tsx`

- [ ] **Step 1: Add `Pill`, `PillSize`, and `PillVariant` exports to the mock**

Open `src/test/mocks/modules/azureDevopsUi.tsx` and append the following before the final closing line:

```tsx
// ---- Pill ----
export const PillSize = { compact: 0, regular: 1, large: 2 };
export const PillVariant = { standard: 0, outlined: 1, colored: 2, themedStandard: 3 };
export const Pill: React.FC<
  React.PropsWithChildren<{
    size?: number;
    variant?: number;
    iconProps?: { iconName: string };
    className?: string;
  }>
> = ({ children }) => <span data-testid="pill">{children}</span>;
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
npm test -- --testPathPattern="azureDevopsMocks" --runInBand
```

Expected: all tests pass (no output changes from the mock addition).

- [ ] **Step 3: Commit**

```bash
git add src/test/mocks/modules/azureDevopsUi.tsx
git commit -m "test: add Pill/PillSize/PillVariant to azure-devops-ui mock"
```

---

## Task 2: Swap Merge / Delete button order in TagManagerApp

**Files:**
- Modify: `src/app/TagManagerApp.tsx` (lines ~216–233)
- Test: `src/app/TagManagerApp.test.tsx`

- [ ] **Step 1: Write a failing test**

Add this test inside the existing `describe("TagManagerApp")` block in `src/app/TagManagerApp.test.tsx`:

```tsx
it("shows Merge button before Delete button", async () => {
  mockTagService.getAllTags.mockResolvedValue([]);

  render(<TagManagerApp />);

  await waitFor(() => expect(screen.queryByText("Loading")).not.toBeInTheDocument());

  const buttons = screen.getAllByRole("button");
  const mergeIndex = buttons.findIndex((b) => b.textContent?.includes("Merge"));
  const deleteIndex = buttons.findIndex((b) => b.textContent?.includes("Delete"));

  expect(mergeIndex).toBeGreaterThan(-1);
  expect(deleteIndex).toBeGreaterThan(-1);
  expect(mergeIndex).toBeLessThan(deleteIndex);
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- --testPathPattern="TagManagerApp.test" --runInBand
```

Expected: FAIL — `expect(mergeIndex).toBeLessThan(deleteIndex)` fails because Delete is currently first.

- [ ] **Step 3: Swap the array entries in TagManagerApp.tsx**

In `src/app/TagManagerApp.tsx`, replace the `commandBarItems` array (lines ~216–233):

```tsx
const commandBarItems: IHeaderCommandBarItem[] = [
  {
    id: "merge",
    text: `Merge${sel}`,
    iconProps: { iconName: "BranchMerge" },
    disabled: n === 0,
    onActivate: handleMergeClick,
    important: true,
  },
  {
    id: "delete",
    text: `Delete${sel}`,
    iconProps: { iconName: "Delete" },
    disabled: n === 0,
    onActivate: handleDeleteClick,
    important: true,
  },
];
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npm test -- --testPathPattern="TagManagerApp.test" --runInBand
```

Expected: all tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/app/TagManagerApp.tsx src/app/TagManagerApp.test.tsx
git commit -m "feat: move Merge button before Delete in command bar"
```

---

## Task 3: Upgrade DeleteDialog tag list to Pill components

**Files:**
- Modify: `src/app/DeleteDialog.tsx`
- Create: `src/app/DeleteDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/app/DeleteDialog.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { DeleteDialog } from "./DeleteDialog";

const tags = [
  { id: "1", name: "alpha", url: "u" },
  { id: "2", name: "beta", url: "u" },
  { id: "3", name: "gamma", url: "u" },
];

describe("DeleteDialog", () => {
  it("shows a count label instead of a TAG column header", () => {
    render(
      <DeleteDialog tags={tags} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    expect(screen.getByText("3 tags will be deleted")).toBeInTheDocument();
    expect(screen.queryByText("Tag")).not.toBeInTheDocument();
  });

  it("renders each tag as a pill", () => {
    render(
      <DeleteDialog tags={tags} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    const pills = screen.getAllByTestId("pill");
    expect(pills).toHaveLength(3);
    expect(pills[0]).toHaveTextContent("alpha");
    expect(pills[1]).toHaveTextContent("beta");
    expect(pills[2]).toHaveTextContent("gamma");
  });

  it("uses singular label for a single tag", () => {
    render(
      <DeleteDialog
        tags={[{ id: "1", name: "only", url: "u" }]}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText("1 tag will be deleted")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npm test -- --testPathPattern="DeleteDialog.test" --runInBand
```

Expected: FAIL — count label and `data-testid="pill"` don't exist yet.

- [ ] **Step 3: Rewrite DeleteDialog.tsx**

Replace the entire file content:

```tsx
// src/app/DeleteDialog.tsx
import React from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Pill, PillSize, PillVariant } from "azure-devops-ui/Pill";
import { TagItem } from "../types";

interface DeleteDialogProps {
  tags: TagItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  tags,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      titleProps={{ text: "Delete Tags" }}
      footerButtonProps={[
        { text: "Cancel", onClick: onCancel },
        {
          text: `Delete ${tags.length} tag${tags.length !== 1 ? "s" : ""}`,
          primary: true,
          danger: true,
          onClick: onConfirm,
          iconProps: { iconName: "Delete" },
        },
      ]}
      onDismiss={onCancel}
    >
      <MessageCard severity={MessageCardSeverity.Warning}>
        This will permanently delete the following tag
        {tags.length !== 1 ? "s" : ""} and remove{" "}
        {tags.length !== 1 ? "them" : "it"} from all work items and pull
        requests. This cannot be undone.
      </MessageCard>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--palette-neutral-60, #666)",
          margin: "12px 0 8px",
        }}
      >
        {tags.length} tag{tags.length !== 1 ? "s" : ""} will be deleted
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "0 0 16px" }}>
        {tags.map((t) => (
          <Pill
            key={t.id}
            size={PillSize.regular}
            variant={PillVariant.outlined}
            iconProps={{ iconName: "Tag" }}
          >
            {t.name}
          </Pill>
        ))}
      </div>
    </Dialog>
  );
};
```

- [ ] **Step 4: Run to confirm tests pass**

```bash
npm test -- --testPathPattern="DeleteDialog.test" --runInBand
```

Expected: all 3 tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test -- --runInBand
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/DeleteDialog.tsx src/app/DeleteDialog.test.tsx
git commit -m "feat: replace flat tag list with Pill components in DeleteDialog"
```

---

## Task 4: Upgrade MergeDialog — source pills + fixed inline target list

**Files:**
- Modify: `src/app/MergeDialog.tsx`
- Modify: `src/app/MergeDialog.test.tsx`

- [ ] **Step 1: Update and extend MergeDialog tests**

Replace the entire content of `src/app/MergeDialog.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MergeDialog } from "./MergeDialog";

describe("MergeDialog", () => {
  const sources = [{ id: "1", name: "old-tag", url: "u" }];
  const allTags = [
    { id: "1", name: "old-tag", url: "u" },
    { id: "2", name: "platform", url: "u" },
    { id: "3", name: "frontend", url: "u" },
  ];

  it("shows source tags as pills with a count label", () => {
    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText("1 tag will be merged")).toBeInTheDocument();
    const pills = screen.getAllByTestId("pill");
    expect(pills.some((p) => p.textContent === "old-tag")).toBe(true);
  });

  it("shows all non-source tags immediately without typing", () => {
    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText("platform")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("excludes source tags from the target list", () => {
    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    // "old-tag" appears once (as a source pill) but not in the selectable target list rows
    const listRows = screen
      .getAllByRole("generic")
      .filter((el) => el.getAttribute("data-target-row") === "true");
    expect(listRows.every((row) => !row.textContent?.includes("old-tag"))).toBe(true);
  });

  it("filters the target list as the user types", () => {
    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search or create a tag…"), {
      target: { value: "plat" },
    });

    expect(screen.getByText("platform")).toBeInTheDocument();
    expect(screen.queryByText("frontend")).not.toBeInTheDocument();
  });

  it("supports selecting an existing suggestion", () => {
    const onConfirm = jest.fn();

    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search or create a tag…"), {
      target: { value: "plat" },
    });

    fireEvent.mouseDown(screen.getByText("platform"));
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));

    expect(onConfirm).toHaveBeenCalledWith("platform");
  });

  it("shows create-new affordance for unknown target tag", () => {
    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search or create a tag…"), {
      target: { value: "newly-created" },
    });

    expect(screen.getByText("Create new")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npm test -- --testPathPattern="MergeDialog.test" --runInBand
```

Expected: FAIL — placeholder text mismatch, count label missing, non-source tags not immediately visible, `data-target-row` not present.

- [ ] **Step 3: Rewrite MergeDialog.tsx**

Replace the entire file content:

```tsx
// src/app/MergeDialog.tsx
import React, { useState } from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { FormItem } from "azure-devops-ui/FormItem";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Pill, PillSize, PillVariant } from "azure-devops-ui/Pill";
import { TagItem } from "../types";

interface MergeDialogProps {
  sources: TagItem[];
  allTags: TagItem[];
  onConfirm: (targetName: string) => void;
  onCancel: () => void;
}

export const MergeDialog: React.FC<MergeDialogProps> = ({
  sources,
  allTags,
  onConfirm,
  onCancel,
}) => {
  const [targetName, setTargetName] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const trimmed = targetName.trim();

  const suggestions = allTags.filter(
    (t) =>
      !sources.some((s) => s.id === t.id) &&
      (trimmed.length === 0 || t.name.toLowerCase().includes(trimmed.toLowerCase()))
  );

  const isNewTag =
    trimmed.length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  const totalItems = suggestions.length + (isNewTag ? 1 : 0);

  const isValid = trimmed.length > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetName(e.target.value);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (totalItems === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      if (highlightedIndex < suggestions.length) {
        selectSuggestion(suggestions[highlightedIndex].name);
      } else {
        setHighlightedIndex(-1);
      }
    } else if (e.key === "Escape") {
      setHighlightedIndex(-1);
    }
  };

  const selectSuggestion = (name: string) => {
    setTargetName(name);
    setHighlightedIndex(-1);
  };

  return (
    <Dialog
      titleProps={{ text: "Merge Tags" }}
      footerButtonProps={[
        { text: "Cancel", onClick: onCancel },
        {
          text: "Merge",
          primary: true,
          danger: true,
          disabled: !isValid,
          onClick: () => onConfirm(trimmed),
          iconProps: { iconName: "BranchMerge" },
        },
      ]}
      onDismiss={onCancel}
    >
      <MessageCard severity={MessageCardSeverity.Warning}>
        The following tag{sources.length !== 1 ? "s" : ""} will be merged into
        the target and removed from the project.
      </MessageCard>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--palette-neutral-60, #666)",
          margin: "12px 0 8px",
        }}
      >
        {sources.length} tag{sources.length !== 1 ? "s" : ""} will be merged
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "0 0 16px" }}>
        {sources.map((t) => (
          <Pill
            key={t.id}
            size={PillSize.regular}
            variant={PillVariant.outlined}
            iconProps={{ iconName: "Tag" }}
          >
            {t.name}
          </Pill>
        ))}
      </div>
      <FormItem label="Target tag">
        <div>
          <input
            type="text"
            value={targetName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search or create a tag…"
            autoComplete="off"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "4px 8px",
              fontSize: "14px",
              lineHeight: "20px",
              border: "1px solid var(--palette-neutral-20, #c8c6c4)",
              borderRadius: "2px 2px 0 0",
              background: "var(--callout-background-color, #fff)",
              color: "var(--text-primary-color, #1e1e1e)",
              outline: "none",
            }}
          />
          <div
            style={{
              border: "1px solid var(--palette-neutral-20, #c8c6c4)",
              borderTop: "none",
              borderRadius: "0 0 2px 2px",
              maxHeight: "160px",
              overflowY: "auto",
            }}
          >
            {suggestions.map((t, i) => (
              <div
                key={t.id}
                data-target-row="true"
                onMouseDown={() => selectSuggestion(t.name)}
                onMouseEnter={() => setHighlightedIndex(i)}
                style={{
                  padding: "6px 10px",
                  cursor: "pointer",
                  background:
                    i === highlightedIndex
                      ? "var(--palette-neutral-8, #e8e8e8)"
                      : "transparent",
                }}
              >
                <Pill
                  size={PillSize.regular}
                  variant={PillVariant.outlined}
                  iconProps={{ iconName: "Tag" }}
                >
                  {t.name}
                </Pill>
              </div>
            ))}
            {isNewTag && (
              <div
                onMouseDown={() => setHighlightedIndex(-1)}
                onMouseEnter={() => setHighlightedIndex(suggestions.length)}
                style={{
                  padding: "6px 10px",
                  cursor: "pointer",
                  background:
                    highlightedIndex === suggestions.length
                      ? "var(--palette-neutral-8, #e8e8e8)"
                      : "transparent",
                  borderTop:
                    suggestions.length > 0
                      ? "1px solid var(--palette-neutral-10, #e0e0e0)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    color: "var(--communication-foreground, #0078d4)",
                    fontWeight: 600,
                  }}
                >
                  {trimmed}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--communication-foreground, #0078d4)",
                    background: "var(--palette-primary-tint-10, #deecf9)",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontWeight: 600,
                    letterSpacing: "0.2px",
                  }}
                >
                  Create new
                </span>
              </div>
            )}
          </div>
        </div>
      </FormItem>
    </Dialog>
  );
};
```

- [ ] **Step 4: Run MergeDialog tests to confirm they pass**

```bash
npm test -- --testPathPattern="MergeDialog.test" --runInBand
```

Expected: all 6 tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test -- --runInBand
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/MergeDialog.tsx src/app/MergeDialog.test.tsx
git commit -m "feat: pills + fixed inline target list in MergeDialog"
```

---

## Self-Review Checklist

- **Button order (Change 1):** Covered by Task 2 — test checks DOM order, implementation swaps array entries. ✓
- **DeleteDialog pills (Change 2):** Covered by Task 3 — tests verify count label, pill count, singular/plural. ✓
- **MergeDialog source pills (Change 2):** Covered by Task 4 — test verifies count label and source pill presence. ✓
- **Source tags excluded from target list (bug fix):** Covered by Task 4 — `data-target-row` test asserts source tags absent from selectable rows. ✓
- **All non-source tags visible on empty input:** Covered by Task 4 — test checks both non-source tags are present before any typing. ✓
- **Live filtering:** Covered by Task 4 — test types "plat" and verifies "frontend" disappears. ✓
- **Selecting existing suggestion:** Covered by Task 4 — existing test updated for new placeholder. ✓
- **Create new affordance:** Covered by Task 4 — existing test updated for new placeholder. ✓
- **Pill mock prerequisite:** Task 1 adds mock before any component tasks. ✓
- **No `showSuggestions`, `containerRef`, `useEffect`, `onFocus` in new MergeDialog:** New file content in Task 4 Step 3 omits all of these. ✓
