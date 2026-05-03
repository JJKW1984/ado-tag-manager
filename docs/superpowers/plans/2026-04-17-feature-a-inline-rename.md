# Feature A — Inline Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rename a tag by double-clicking its name in the table, without leaving the page.

**Architecture:** A new `EditableTagName` component manages its own editing state (view → edit → view). Validation lives in a shared `validateTagName` utility. `TagTable` threads the new optional props through to each name cell. `TagManagerApp` supplies `handleRename`, which calls the existing `tagService.renameTagById` and updates local state on success.

**Tech Stack:** React 16 (functional components + hooks), TypeScript 5, Jest 29, `@testing-library/react` 12, `@testing-library/user-event` 14, `azure-devops-ui` table primitives.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/utils/validateTagName.ts` | Pure function: validates a tag name string, returns `{ valid, reason? }` |
| Create | `src/utils/validateTagName.test.ts` | Unit tests for the above |
| Create | `src/utils/sanitizeError.ts` | Minimal error-message cleaner (Security Plan will expand this later) |
| Create | `src/utils/sanitizeError.test.ts` | Unit tests for the above |
| Create | `src/app/EditableTagName.tsx` | Self-contained editable name cell: display mode + edit mode + validation |
| Create | `src/app/EditableTagName.test.tsx` | Unit tests for EditableTagName |
| Modify | `src/app/TagTable.tsx` | Add optional `onRename` + `existingNames` props; render `EditableTagName` when present |
| Create | `src/app/TagManagerApp.rename.test.tsx` | Integration tests for the rename flow end-to-end |
| Modify | `src/app/TagManagerApp.tsx` | Add `handleRename` callback; pass `onRename` + `existingNames` to `TagTable` |

---

## Task 1 — `validateTagName` utility

**Files:**
- Create: `src/utils/validateTagName.ts`
- Create: `src/utils/validateTagName.test.ts`

- [ ] **Step 1.1 — Write the failing tests**

Create `src/utils/validateTagName.test.ts`:

```typescript
import { validateTagName } from "./validateTagName";

describe("validateTagName", () => {
  it("accepts a normal tag name", () => {
    expect(validateTagName("bug")).toEqual({ valid: true });
  });

  it("rejects an empty string", () => {
    const result = validateTagName("   ");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("rejects a name longer than 256 characters", () => {
    const result = validateTagName("a".repeat(257));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/256/);
  });

  it("rejects a name that contains a semicolon", () => {
    const result = validateTagName("bug;feature");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/semicolon/i);
  });

  it("accepts a name that is exactly 256 characters", () => {
    expect(validateTagName("a".repeat(256))).toEqual({ valid: true });
  });

  it("accepts a name with spaces and hyphens", () => {
    expect(validateTagName("payment-gateway v2")).toEqual({ valid: true });
  });
});
```

- [ ] **Step 1.2 — Run tests to confirm they fail**

```bash
cd d:/tagtidy-azure-boards
pnpm test -- src/utils/validateTagName.test.ts --verbose
```

Expected: `Cannot find module './validateTagName'`

- [ ] **Step 1.3 — Implement `validateTagName`**

Create `src/utils/validateTagName.ts`:

```typescript
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateTagName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "Tag name cannot be empty." };
  }
  if (trimmed.length > 256) {
    return { valid: false, reason: "Tag name cannot exceed 256 characters." };
  }
  if (trimmed.includes(";")) {
    return {
      valid: false,
      reason: 'Tag names cannot contain semicolons — ADO uses ";" to separate tags.',
    };
  }
  return { valid: true };
}
```

- [ ] **Step 1.4 — Run tests to confirm they pass**

```bash
pnpm test -- src/utils/validateTagName.test.ts --verbose
```

Expected: 6 tests pass.

- [ ] **Step 1.5 — Commit**

```bash
git add src/utils/validateTagName.ts src/utils/validateTagName.test.ts
git commit -m "feat: add validateTagName utility"
```

---

## Task 2 — `sanitizeError` utility

**Files:**
- Create: `src/utils/sanitizeError.ts`
- Create: `src/utils/sanitizeError.test.ts`

> **Note:** The Security Hardening plan adds a fuller version of this. If that plan runs first, skip this task — `src/utils/sanitizeError.ts` will already exist.

- [ ] **Step 2.1 — Write the failing tests**

Create `src/utils/sanitizeError.test.ts`:

```typescript
import { sanitizeError } from "./sanitizeError";

describe("sanitizeError", () => {
  it("returns the message from an Error", () => {
    expect(sanitizeError(new Error("something went wrong"))).toBe(
      "something went wrong"
    );
  });

  it("stringifies non-Error values", () => {
    expect(sanitizeError("raw string")).toBe("raw string");
    expect(sanitizeError(42)).toBe("42");
  });

  it("truncates messages longer than 200 characters", () => {
    const result = sanitizeError(new Error("x".repeat(300)));
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("strips content after the first newline", () => {
    const result = sanitizeError(new Error("first line\nat: somewhere"));
    expect(result).toBe("first line");
  });
});
```

- [ ] **Step 2.2 — Run tests to confirm they fail**

```bash
pnpm test -- src/utils/sanitizeError.test.ts --verbose
```

Expected: `Cannot find module './sanitizeError'`

- [ ] **Step 2.3 — Implement `sanitizeError`**

Create `src/utils/sanitizeError.ts`:

```typescript
export function sanitizeError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw);
  const firstLine = msg.split("\n")[0];
  return firstLine.slice(0, 200);
}
```

- [ ] **Step 2.4 — Run tests to confirm they pass**

```bash
pnpm test -- src/utils/sanitizeError.test.ts --verbose
```

Expected: 4 tests pass.

- [ ] **Step 2.5 — Commit**

```bash
git add src/utils/sanitizeError.ts src/utils/sanitizeError.test.ts
git commit -m "feat: add sanitizeError utility"
```

---

## Task 3 — `EditableTagName`: display mode

**Files:**
- Create: `src/app/EditableTagName.tsx`
- Create: `src/app/EditableTagName.test.tsx`

- [ ] **Step 3.1 — Write the failing tests for display mode**

Create `src/app/EditableTagName.test.tsx`:

```typescript
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableTagName } from "./EditableTagName";

const defaultProps = {
  name: "old-tag",
  onRename: jest.fn(),
  onCancel: jest.fn(),
  existingNames: ["platform", "frontend"],
};

beforeEach(() => {
  defaultProps.onRename.mockReset();
  defaultProps.onCancel.mockReset();
});

describe("EditableTagName — display mode", () => {
  it("renders the tag name as text", () => {
    render(<EditableTagName {...defaultProps} />);
    expect(screen.getByText("old-tag")).toBeInTheDocument();
  });

  it("does not show an input initially", () => {
    render(<EditableTagName {...defaultProps} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows a pencil icon when hovered", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.hover(screen.getByText("old-tag"));
    expect(screen.getByTitle("Rename")).toBeInTheDocument();
  });

  it("hides the pencil icon when not hovered", () => {
    render(<EditableTagName {...defaultProps} />);
    expect(screen.queryByTitle("Rename")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2 — Run tests to confirm they fail**

```bash
pnpm test -- src/app/EditableTagName.test.tsx --verbose
```

Expected: `Cannot find module './EditableTagName'`

- [ ] **Step 3.3 — Implement display mode only**

Create `src/app/EditableTagName.tsx`:

```typescript
import React, { useState } from "react";
import { validateTagName } from "../utils/validateTagName";

export interface EditableTagNameProps {
  name: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
  existingNames: string[];
}

export const EditableTagName: React.FC<EditableTagNameProps> = ({
  name,
  onRename,
  onCancel,
  existingNames,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  if (editing) {
    // Placeholder — edit mode implemented in Task 4
    return <span>{name}</span>;
  }

  return (
    <span
      onDoubleClick={() => {
        setDraft(name);
        setError(null);
        setEditing(true);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "default" }}
    >
      {name}
      {hovered && (
        <span
          aria-hidden="true"
          title="Rename"
          style={{ fontSize: "11px", color: "var(--palette-neutral-30, #aaa)" }}
        >
          ✎
        </span>
      )}
    </span>
  );
};
```

- [ ] **Step 3.4 — Run display-mode tests to confirm they pass**

```bash
pnpm test -- src/app/EditableTagName.test.tsx --verbose
```

Expected: 4 display-mode tests pass.

- [ ] **Step 3.5 — Commit**

```bash
git add src/app/EditableTagName.tsx src/app/EditableTagName.test.tsx
git commit -m "feat: add EditableTagName display mode with hover pencil"
```

---

## Task 4 — `EditableTagName`: edit mode, commit, cancel

**Files:**
- Modify: `src/app/EditableTagName.test.tsx`
- Modify: `src/app/EditableTagName.tsx`

- [ ] **Step 4.1 — Add failing tests for edit mode**

Append to the `describe` blocks in `src/app/EditableTagName.test.tsx`:

```typescript
describe("EditableTagName — entering edit mode", () => {
  it("shows a text input after double-click", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toBeInTheDocument();
  });

  it("pre-fills the input with the current name", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toHaveValue("old-tag");
  });
});

describe("EditableTagName — committing a rename", () => {
  it("calls onRename with the trimmed new value when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "new-name");
    await user.keyboard("[Enter]");
    expect(defaultProps.onRename).toHaveBeenCalledWith("new-name");
  });

  it("exits edit mode after Enter", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    await user.keyboard("[Enter]");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("calls onRename when the input is blurred", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "blurred-name");
    await user.tab();
    expect(defaultProps.onRename).toHaveBeenCalledWith("blurred-name");
  });
});

describe("EditableTagName — cancelling a rename", () => {
  it("calls onCancel and exits edit mode when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    await user.keyboard("[Escape]");
    expect(defaultProps.onCancel).toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the original name again after Escape", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "something-else");
    await user.keyboard("[Escape]");
    expect(screen.getByText("old-tag")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2 — Run new tests to confirm they fail**

```bash
pnpm test -- src/app/EditableTagName.test.tsx --verbose
```

Expected: The new edit-mode, commit, and cancel tests fail; display-mode tests still pass.

- [ ] **Step 4.3 — Implement edit mode, commit, and cancel**

Replace the full `src/app/EditableTagName.tsx` with:

```typescript
import React, { useRef, useState } from "react";
import { validateTagName } from "../utils/validateTagName";

export interface EditableTagNameProps {
  name: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
  existingNames: string[];
}

export const EditableTagName: React.FC<EditableTagNameProps> = ({
  name,
  onRename,
  onCancel,
  existingNames,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  // Prevents blur from triggering a second commit after Enter already committed.
  const committedRef = useRef(false);

  const commit = () => {
    if (committedRef.current) return;
    const validation = validateTagName(draft);
    if (!validation.valid) {
      setError(validation.reason ?? "Invalid tag name.");
      return;
    }
    const isDuplicate =
      draft.trim().toLowerCase() !== name.toLowerCase() &&
      existingNames.some((n) => n.toLowerCase() === draft.trim().toLowerCase());
    if (isDuplicate) {
      setError("A tag with this name already exists — use Merge instead.");
      return;
    }
    committedRef.current = true;
    setEditing(false);
    setError(null);
    onRename(draft.trim());
    // Reset after microtask so blur fired in the same tick is swallowed.
    Promise.resolve().then(() => {
      committedRef.current = false;
    });
  };

  const cancel = () => {
    committedRef.current = true;
    setEditing(false);
    setDraft(name);
    setError(null);
    onCancel();
    Promise.resolve().then(() => {
      committedRef.current = false;
    });
  };

  if (editing) {
    return (
      <div>
        <input
          aria-label="Edit tag name"
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "2px 6px",
            fontSize: "13px",
            border: "1px solid var(--palette-neutral-20, #c8c6c4)",
            borderRadius: "2px",
            background: "var(--callout-background-color, #fff)",
            color: "var(--text-primary-color, #1e1e1e)",
            outline: "none",
          }}
        />
        {error && (
          <div
            role="alert"
            style={{
              fontSize: "12px",
              color: "var(--status-error-foreground, #c4314b)",
              marginTop: "2px",
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      onDoubleClick={() => {
        setDraft(name);
        setError(null);
        setEditing(true);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "default" }}
    >
      {name}
      {hovered && (
        <span
          aria-hidden="true"
          title="Rename"
          style={{ fontSize: "11px", color: "var(--palette-neutral-30, #aaa)" }}
        >
          ✎
        </span>
      )}
    </span>
  );
};
```

- [ ] **Step 4.4 — Run all EditableTagName tests to confirm they pass**

```bash
pnpm test -- src/app/EditableTagName.test.tsx --verbose
```

Expected: All tests pass (display mode + edit mode + commit + cancel).

- [ ] **Step 4.5 — Commit**

```bash
git add src/app/EditableTagName.tsx src/app/EditableTagName.test.tsx
git commit -m "feat: add EditableTagName edit mode with commit and cancel"
```

---

## Task 5 — `EditableTagName`: validation error states

**Files:**
- Modify: `src/app/EditableTagName.test.tsx`

- [ ] **Step 5.1 — Add failing tests for validation**

Append to `src/app/EditableTagName.test.tsx`:

```typescript
describe("EditableTagName — validation", () => {
  it("shows an error and stays in edit mode when Enter is pressed with empty input", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it("shows a merge hint when the typed name matches an existing tag", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "platform");
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toHaveTextContent(/Merge/i);
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it("treats duplicate check as case-insensitive", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "PLATFORM");
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toHaveTextContent(/Merge/i);
  });

  it("allows renaming to the same name (no-op rename, not a duplicate)", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    await user.keyboard("[Enter]");
    expect(defaultProps.onRename).toHaveBeenCalledWith("old-tag");
  });

  it("clears the error message when the user starts typing again", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.type(input, "f");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2 — Run new tests to confirm they fail**

```bash
pnpm test -- src/app/EditableTagName.test.tsx --verbose
```

Expected: The 5 new validation tests fail; earlier tests still pass.

- [ ] **Step 5.3 — Run all tests to confirm they pass (validation logic already in place from Task 4)**

The validation logic was already added in Task 4's implementation (`commit()` function checks `validateTagName` and `isDuplicate`). Run the full file to verify:

```bash
pnpm test -- src/app/EditableTagName.test.tsx --verbose
```

Expected: All tests pass. If any fail, review the `commit()` function in `EditableTagName.tsx` against the logic in Task 4 step 4.3.

- [ ] **Step 5.4 — Commit**

```bash
git add src/app/EditableTagName.test.tsx
git commit -m "test: add validation tests for EditableTagName"
```

---

## Task 6 — Wire `EditableTagName` into `TagTable`

**Files:**
- Modify: `src/app/TagTable.tsx`
- Modify: `src/app/TagTable.test.tsx`

- [ ] **Step 6.1 — Add failing tests for the wired TagTable**

Append to `src/app/TagTable.test.tsx`:

```typescript
describe("TagTable — rename wiring", () => {
  it("renders EditableTagName when onRename is provided", async () => {
    const user = userEvent.setup();
    const onRename = jest.fn();
    render(
      <TagTable
        tags={[{ id: "1", name: "alpha", url: "u1" }]}
        selectedIds={new Set()}
        onToggle={jest.fn()}
        onToggleAll={jest.fn()}
        onRename={onRename}
        existingNames={["alpha"]}
      />
    );
    await user.dblClick(screen.getByText("alpha"));
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toBeInTheDocument();
  });

  it("renders plain text when onRename is not provided", () => {
    render(
      <TagTable
        tags={[{ id: "1", name: "alpha", url: "u1" }]}
        selectedIds={new Set()}
        onToggle={jest.fn()}
        onToggleAll={jest.fn()}
      />
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.queryByTitle("Rename")).not.toBeInTheDocument();
  });

  it("calls onRename with tagId and new name when rename is committed", async () => {
    const user = userEvent.setup();
    const onRename = jest.fn();
    render(
      <TagTable
        tags={[{ id: "tag-1", name: "alpha", url: "u1" }]}
        selectedIds={new Set()}
        onToggle={jest.fn()}
        onToggleAll={jest.fn()}
        onRename={onRename}
        existingNames={["alpha"]}
      />
    );
    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "beta");
    await user.keyboard("[Enter]");
    expect(onRename).toHaveBeenCalledWith("tag-1", "beta");
  });
});
```

- [ ] **Step 6.2 — Run new tests to confirm they fail**

```bash
pnpm test -- src/app/TagTable.test.tsx --verbose
```

Expected: The 3 new rename-wiring tests fail; original 2 tests pass.

- [ ] **Step 6.3 — Modify `TagTable` to accept and wire the new props**

Replace the full `src/app/TagTable.tsx` with:

```typescript
// src/app/TagTable.tsx
import React, { useMemo } from "react";
import {
  ColumnFillId,
  ITableColumn,
  SimpleTableCell,
  Table,
} from "azure-devops-ui/Table";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { Checkbox } from "azure-devops-ui/Checkbox";
import { ZeroData } from "azure-devops-ui/ZeroData";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { TagItem } from "../types";
import { EditableTagName } from "./EditableTagName";

interface TagTableProps {
  tags: TagItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (select: boolean) => void;
  onRename?: (tagId: string, newName: string) => void;
  existingNames?: string[];
}

// Column widths are stable ObservableValues — defined outside the component
// so they are not recreated on every render (prevents ADO Table column flicker).
const colWidthSelect = new ObservableValue(48);
const colWidthName = new ObservableValue(300);

export const TagTable: React.FC<TagTableProps> = ({
  tags,
  selectedIds,
  onToggle,
  onToggleAll,
  onRename,
  existingNames = [],
}) => {
  if (tags.length === 0) {
    return (
      <ZeroData
        primaryText="No tags found"
        secondaryText="This project has no work item tags yet."
        imageAltText=""
      />
    );
  }

  const allSelected = tags.length > 0 && tags.every((t) => selectedIds.has(t.id));
  const someSelected = tags.some((t) => selectedIds.has(t.id));

  const tableItems = new ArrayItemProvider<TagItem>(tags);

  // Column renderers that close over selectedIds/onToggle are memoized so the
  // Table does not reinitialize on every checkbox toggle.
  const columns: ITableColumn<TagItem>[] = useMemo(() => [
    {
      id: "select",
      name: "",
      renderCell: (_rowIndex, columnIndex, tableColumn, item) => (
        <SimpleTableCell
          columnIndex={columnIndex}
          tableColumn={tableColumn}
          key={`sel-${item.id}`}
        >
          <Checkbox
            checked={selectedIds.has(item.id)}
            onChange={(_e, _checked) => onToggle(item.id)}
          />
        </SimpleTableCell>
      ),
      renderHeaderCell: (columnIndex, tableColumn) => (
        <SimpleTableCell
          columnIndex={columnIndex}
          tableColumn={tableColumn}
          key="sel-header"
        >
          <Checkbox
            triState={true}
            checked={someSelected && !allSelected ? undefined : allSelected}
            onChange={(_e, checked) => onToggleAll(checked ?? false)}
          />
        </SimpleTableCell>
      ),
      readonly: true,
      width: colWidthSelect,
    },
    {
      id: "name",
      name: "Tag",
      renderCell: (_rowIndex, columnIndex, tableColumn, item) => (
        <SimpleTableCell
          columnIndex={columnIndex}
          tableColumn={tableColumn}
          key={`name-${item.id}`}
        >
          {onRename ? (
            <EditableTagName
              name={item.name}
              onRename={(newName) => onRename(item.id, newName)}
              onCancel={() => {}}
              existingNames={existingNames}
            />
          ) : (
            item.name
          )}
        </SimpleTableCell>
      ),
      readonly: true,
      width: colWidthName,
    },
    {
      id: ColumnFillId,
      name: "Work Items",
      renderCell: (_rowIndex, columnIndex, tableColumn, item) => (
        <SimpleTableCell
          columnIndex={columnIndex}
          tableColumn={tableColumn}
          key={`count-${item.id}`}
        >
          {item.count === undefined ? (
            <span style={{ color: "var(--palette-neutral-30, #aaa)" }}>—</span>
          ) : item.count === -1 ? (
            <Spinner size={SpinnerSize.small} />
          ) : (
            String(item.count)
          )}
        </SimpleTableCell>
      ),
      readonly: true,
      width: -1,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedIds, onToggle, onToggleAll, allSelected, someSelected, onRename, existingNames]);

  return (
    <Table<TagItem>
      ariaLabel="Work item tags"
      columns={columns}
      itemProvider={tableItems}
      role="grid"
    />
  );
};
```

- [ ] **Step 6.4 — Run all TagTable tests to confirm they pass**

```bash
pnpm test -- src/app/TagTable.test.tsx --verbose
```

Expected: All 5 tests pass.

- [ ] **Step 6.5 — Run the full suite to confirm no regressions**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 6.6 — Commit**

```bash
git add src/app/TagTable.tsx src/app/TagTable.test.tsx
git commit -m "feat: wire EditableTagName into TagTable name column"
```

---

## Task 7 — `TagManagerApp`: `handleRename` + integration tests (success path)

**Files:**
- Create: `src/app/TagManagerApp.rename.test.tsx`
- Modify: `src/app/TagManagerApp.tsx`

- [ ] **Step 7.1 — Write the failing integration tests**

Create `src/app/TagManagerApp.rename.test.tsx`:

```typescript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockTagService = {
  getAllTags: jest.fn(),
  getProjectName: jest.fn(),
  deleteTagById: jest.fn(),
  renameTagById: jest.fn(),
  mergeTag: jest.fn(),
  countTagAcrossProjects: jest.fn(),
};

jest.mock("../services/TagService", () => ({
  TagService: jest.fn(() => mockTagService),
}));

import { TagManagerApp } from "./TagManagerApp";

beforeEach(() => {
  localStorage.clear();
  Object.values(mockTagService).forEach((fn) => (fn as jest.Mock).mockReset());
  mockTagService.getProjectName.mockResolvedValue("Demo Project");
  mockTagService.getAllTags.mockResolvedValue([
    { id: "1", name: "alpha", url: "u" },
    { id: "2", name: "beta", url: "u" },
  ]);
  mockTagService.renameTagById.mockResolvedValue({ id: "1", name: "renamed-tag", url: "u" });
});

describe("TagManagerApp — rename flow", () => {
  it("calls renameTagById with the correct id and new name", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "renamed-tag");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      expect(mockTagService.renameTagById).toHaveBeenCalledWith("1", "renamed-tag");
    });
  });

  it("updates the tag name in the list after a successful rename", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "renamed-tag");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      expect(screen.getByText("renamed-tag")).toBeInTheDocument();
      expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    });
  });

  it("appends a success entry to the activity log after rename", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "renamed-tag");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      expect(screen.getByText(/Activity Log/)).toBeInTheDocument();
    });

    // Open the log
    const user2 = userEvent.setup();
    await user2.click(screen.getByText(/Activity Log/));

    await waitFor(() => {
      expect(
        screen.getByText(/✓ Renamed "alpha" → "renamed-tag"/)
      ).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 7.2 — Run tests to confirm they fail**

```bash
pnpm test -- src/app/TagManagerApp.rename.test.tsx --verbose
```

Expected: Tests fail because `TagManagerApp` does not yet pass `onRename` to `TagTable` and has no `handleRename`.

- [ ] **Step 7.3 — Add `handleRename` and wire it to `TagTable` in `TagManagerApp.tsx`**

Open `src/app/TagManagerApp.tsx`. Make the following changes:

**a) Add import for `sanitizeError` at the top of the file (after the existing imports):**

```typescript
import { sanitizeError } from "../utils/sanitizeError";
```

**b) Add `handleRename` callback after the `updateTagCount` definition (around line 88):**

```typescript
const handleRename = useCallback(async (tagId: string, newName: string) => {
  const original = tags.find((t) => t.id === tagId)?.name ?? tagId;
  const logId = appendLog(`${proj}Renaming "${original}" → "${newName}"…`, "running");
  try {
    const updated = await tagService.renameTagById(tagId, newName);
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, name: updated.name } : t))
    );
    updateLog(logId, `${proj}✓ Renamed "${original}" → "${updated.name}"`, "success");
  } catch (e) {
    updateLog(logId, `${proj}✗ Failed to rename "${original}": ${sanitizeError(e)}`, "error");
  }
}, [tags, proj, appendLog, updateLog]);
```

**c) In the JSX, update the `<TagTable>` call** (around line 303) to pass the new props:

```typescript
<TagTable
  tags={pagedTags}
  selectedIds={selectedIds}
  onToggle={handleToggle}
  onToggleAll={handleToggleAll}
  onRename={handleRename}
  existingNames={tags.map((t) => t.name)}
/>
```

> **Note on `proj` dependency:** `proj` is derived inline (`const proj = projectName ? ...`). Move the `proj` declaration above `handleRename` so it is in scope. It already exists in the file; just ensure `handleRename` is placed after `proj` is declared.

- [ ] **Step 7.4 — Run the integration tests to confirm they pass**

```bash
pnpm test -- src/app/TagManagerApp.rename.test.tsx --verbose
```

Expected: All 3 tests pass.

- [ ] **Step 7.5 — Run the full suite to confirm no regressions**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 7.6 — Commit**

```bash
git add src/app/TagManagerApp.tsx src/app/TagManagerApp.rename.test.tsx
git commit -m "feat: add handleRename to TagManagerApp and wire to TagTable"
```

---

## Task 8 — API failure path

**Files:**
- Modify: `src/app/TagManagerApp.rename.test.tsx`

- [ ] **Step 8.1 — Add failing tests for the error path**

Append to `src/app/TagManagerApp.rename.test.tsx`:

```typescript
describe("TagManagerApp — rename failure", () => {
  it("appends an error log entry when renameTagById throws", async () => {
    mockTagService.renameTagById.mockRejectedValue(new Error("permission denied"));
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "new-name");
    await user.keyboard("[Enter]");

    // Open the log
    await waitFor(() => screen.getByText(/Activity Log/));
    const user2 = userEvent.setup();
    await user2.click(screen.getByText(/Activity Log/));

    await waitFor(() => {
      expect(screen.getByText(/✗ Failed to rename "alpha"/)).toBeInTheDocument();
      expect(screen.getByText(/permission denied/)).toBeInTheDocument();
    });
  });

  it("leaves the original tag name in the list when rename fails", async () => {
    mockTagService.renameTagById.mockRejectedValue(new Error("permission denied"));
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "new-name");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      expect(mockTagService.renameTagById).toHaveBeenCalled();
    });

    // Tag name in state is unchanged because setTags only runs on success
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });
});
```

- [ ] **Step 8.2 — Run new tests to confirm they pass**

```bash
pnpm test -- src/app/TagManagerApp.rename.test.tsx --verbose
```

Expected: All 5 tests pass (3 success + 2 failure).

- [ ] **Step 8.3 — Run the full suite one final time**

```bash
pnpm test
```

Expected: All tests pass with no regressions.

- [ ] **Step 8.4 — Commit**

```bash
git add src/app/TagManagerApp.rename.test.tsx
git commit -m "test: add rename failure path tests for TagManagerApp"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Double-click triggers edit mode → Task 4
- [x] Input pre-filled with current name → Task 4
- [x] Enter commits → Task 4
- [x] Blur commits → Task 4
- [x] Escape cancels → Task 4
- [x] Pencil icon on hover → Task 3
- [x] `validateTagName` on commit → Task 5
- [x] Duplicate detection (case-insensitive) → Task 5
- [x] Duplicate message "use Merge instead" → Task 5
- [x] `EditableTagName` in `TagTable` name column → Task 6
- [x] Falls back to plain text when `onRename` absent → Task 6
- [x] `handleRename` in `TagManagerApp` → Task 7
- [x] Success: `setTags` updates name in list → Task 7
- [x] Success: activity log entry → Task 7
- [x] Failure: log entry with error message → Task 8
- [x] Failure: tag name unchanged in list → Task 8
- [x] `sanitizeError` in error log message → Task 7 (via `sanitizeError` import)

**Cross-plan dependency note:** If the Security Hardening plan (Plan 1) is implemented after this plan, `src/utils/sanitizeError.ts` will already exist. The Security plan should extend the existing file rather than overwrite it.
