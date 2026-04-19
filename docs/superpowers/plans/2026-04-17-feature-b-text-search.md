# Feature B — Text Search Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free-text search input above the alpha-nav that filters the tag list client-side, instantly, with no API calls.

**Architecture:** A new self-contained `SearchBar` component handles the input UI. `TagManagerApp` gains a `searchQuery` state; the existing single-step alpha filter becomes a two-step pipeline (search first, alpha second). `AlphaNav` receives the search-filtered list so its disabled-letter logic reflects the current search results, not the full tag list.

**Tech Stack:** React 16, TypeScript 5, Jest 29, @testing-library/react 12, @testing-library/user-event 14

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/app/SearchBar.tsx` | Self-contained search input with clear button |
| Create | `src/app/SearchBar.test.tsx` | Unit tests for the SearchBar component |
| Modify | `src/app/TagManagerApp.tsx` | Add `searchQuery` state, two-step filter pipeline, render SearchBar |
| Create | `src/app/TagManagerApp.search.test.tsx` | Integration tests for search behaviour in TagManagerApp |

---

### Task 1: SearchBar component

**Files:**
- Create: `src/app/SearchBar.tsx`
- Create: `src/app/SearchBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/SearchBar.test.tsx` with the following content:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("renders a searchbox with default placeholder", () => {
    render(<SearchBar value="" onChange={jest.fn()} />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search tags…")).toBeInTheDocument();
  });

  it("renders with a custom placeholder", () => {
    render(<SearchBar value="" onChange={jest.fn()} placeholder="Find a tag" />);
    expect(screen.getByPlaceholderText("Find a tag")).toBeInTheDocument();
  });

  it("does not show the clear button when value is empty", () => {
    render(<SearchBar value="" onChange={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("shows the clear button when value is non-empty", () => {
    render(<SearchBar value="alpha" onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("calls onChange when the user types", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<SearchBar value="" onChange={onChange} />);
    await user.type(screen.getByRole("searchbox"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("calls onChange with empty string when the clear button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<SearchBar value="alpha" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- --testPathPattern="SearchBar.test" --no-coverage
```

Expected: FAIL — `Cannot find module './SearchBar'`

- [ ] **Step 3: Create the SearchBar component**

Create `src/app/SearchBar.tsx`:

```tsx
import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search tags…",
}) => (
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      padding: "6px 0 8px",
      borderBottom: "1px solid var(--palette-neutral-10, #e0e0e0)",
      marginBottom: "4px",
    }}
  >
    <input
      type="search"
      aria-label="Search tags"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        flex: 1,
        padding: "4px 28px 4px 8px",
        border: "1px solid var(--palette-neutral-20, #ccc)",
        borderRadius: "2px",
        fontSize: "13px",
        color: "var(--text-primary-color, #1e1e1e)",
        background: "var(--palette-neutral-0, #fff)",
        outline: "none",
      }}
    />
    {value && (
      <button
        aria-label="Clear search"
        onClick={() => onChange("")}
        style={{
          position: "absolute",
          right: "4px",
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--palette-neutral-60, #555)",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    )}
  </div>
);
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm test -- --testPathPattern="SearchBar.test" --no-coverage
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/SearchBar.tsx src/app/SearchBar.test.tsx
git commit -m "feat: add SearchBar component with clear button"
```

---

### Task 2: Wire SearchBar into TagManagerApp

**Files:**
- Modify: `src/app/TagManagerApp.tsx`
- Create: `src/app/TagManagerApp.search.test.tsx`

- [ ] **Step 1: Write the failing integration tests**

Create `src/app/TagManagerApp.search.test.tsx`:

```tsx
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
    { id: "3", name: "gamma", url: "u" },
  ]);
});

describe("TagManagerApp — search filter", () => {
  it("renders a search input above the tag table", async () => {
    render(<TagManagerApp />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("typing in the search box filters the tag list", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.type(screen.getByRole("searchbox"), "al");

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.queryByText("beta")).not.toBeInTheDocument();
    expect(screen.queryByText("gamma")).not.toBeInTheDocument();
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.type(screen.getByRole("searchbox"), "AL");

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.queryByText("beta")).not.toBeInTheDocument();
  });

  it("clicking the clear button resets the search and shows all tags", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.type(screen.getByRole("searchbox"), "alpha");
    expect(screen.queryByText("beta")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("gamma")).toBeInTheDocument();
  });

  it("search and alpha filter compose: only tags matching both are shown", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    // "a" matches alpha (has 'a'), beta (has 'a'), gamma (has 'a') — all three
    // Then alpha-filter "G" keeps only tags starting with G => gamma
    await user.type(screen.getByRole("searchbox"), "a");
    await user.click(screen.getByRole("button", { name: "G" }));

    expect(screen.getByText("gamma")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("beta")).not.toBeInTheDocument();
  });

  it("alpha nav disables letters not present in search results", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    // After searching "alpha", only alpha is in results — B and G buttons should be disabled
    await user.type(screen.getByRole("searchbox"), "alpha");

    expect(screen.getByRole("button", { name: "B" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "G" })).toBeDisabled();
  });

  it("changing search query resets the current page to 1", async () => {
    mockTagService.getAllTags.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        id: `${i + 1}`,
        name: `tag-${String(i + 1).padStart(2, "0")}`,
        url: "u",
      }))
    );

    const user = userEvent.setup();
    render(<TagManagerApp />);
    await waitFor(() => expect(screen.getByText("tag-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "tag");
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- --testPathPattern="TagManagerApp.search" --no-coverage
```

Expected: FAIL — `SearchBar` import error or tests fail (searchbox not found)

- [ ] **Step 3: Update TagManagerApp.tsx**

Apply the following changes to `src/app/TagManagerApp.tsx`:

**3a. Add the SearchBar import** (after the StatusLog import on line 17):

```tsx
import { SearchBar } from "./SearchBar";
```

**3b. Add `searchQuery` state** (after the `currentPage` state on line 54, before the `projectName` state):

```tsx
const [searchQuery, setSearchQuery] = useState("");
```

**3c. Add `handleSearchChange`** (after `handleAlphaFilter`, around line 250):

```tsx
const handleSearchChange = (value: string) => {
  setSearchQuery(value);
  setCurrentPage(0);
};
```

**3d. Replace the `filteredTags` computation** (currently starting at line 254) with a two-step pipeline:

Before:
```tsx
const filteredTags = alphaFilter
  ? tags.filter((t) => {
      const ch = t.name[0]?.toUpperCase();
      return alphaFilter === "#"
        ? !(ch >= "A" && ch <= "Z")
        : ch === alphaFilter;
    })
  : tags;
```

After:
```tsx
const searchFiltered = searchQuery.trim()
  ? tags.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
  : tags;

const filteredTags = alphaFilter
  ? searchFiltered.filter((t) => {
      const ch = t.name[0]?.toUpperCase();
      return alphaFilter === "#"
        ? !(ch >= "A" && ch <= "Z")
        : ch === alphaFilter;
    })
  : searchFiltered;
```

**3e. Update `AlphaNav` to receive `searchFiltered`** (in the JSX, change `tags={tags}` to `tags={searchFiltered}`):

Before:
```tsx
<AlphaNav
  tags={tags}
  activeFilter={alphaFilter}
  onFilter={handleAlphaFilter}
/>
```

After:
```tsx
<AlphaNav
  tags={searchFiltered}
  activeFilter={alphaFilter}
  onFilter={handleAlphaFilter}
/>
```

**3f. Add `<SearchBar>` above `<AlphaNav>` in the JSX** (inside the Card's flex column `<div>`):

Before:
```tsx
<div style={{ display: "flex", flexDirection: "column" }}>
  <AlphaNav
    tags={searchFiltered}
    activeFilter={alphaFilter}
    onFilter={handleAlphaFilter}
  />
```

After:
```tsx
<div style={{ display: "flex", flexDirection: "column" }}>
  <SearchBar value={searchQuery} onChange={handleSearchChange} />
  <AlphaNav
    tags={searchFiltered}
    activeFilter={alphaFilter}
    onFilter={handleAlphaFilter}
  />
```

- [ ] **Step 4: Run the search tests to verify they pass**

```
pnpm test -- --testPathPattern="TagManagerApp.search" --no-coverage
```

Expected: PASS — 7 tests pass

- [ ] **Step 5: Run the full test suite to verify no regressions**

```
pnpm test -- --no-coverage
```

Expected: All tests pass (previously passing tests continue to pass)

- [ ] **Step 6: Commit**

```bash
git add src/app/TagManagerApp.tsx src/app/TagManagerApp.search.test.tsx
git commit -m "feat: add text search filter above alpha-nav in TagManagerApp"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|-----------------|------------|
| `SearchBar.tsx` with `value`, `onChange`, `placeholder?` props | Task 1 |
| `<input type="search">` | Task 1 — `SearchBar.tsx` |
| `×` clear button when value is non-empty | Task 1 — `SearchBar.tsx` + tests |
| Placed above `AlphaNav` inside the `<Card>` | Task 2, Step 3f |
| `searchQuery` state in `TagManagerApp` | Task 2, Step 3b |
| Two-step filter: search → alpha | Task 2, Step 3d |
| `AlphaNav` receives `searchFiltered` (not `tags`) | Task 2, Step 3e |
| `currentPage` resets to 0 when `searchQuery` changes | Task 2, Step 3c + test |
| No debounce (synchronous client-side filter) | Task 2 — no debounce in implementation |
| Search + alpha filter compose correctly | Task 2 — test "search and alpha filter compose" |
| Alpha nav disabled letters reflect search results | Task 2 — test "alpha nav disables letters" |

All spec requirements are covered. No extra features added.

### Placeholder scan

No TBDs, TODOs, or "similar to Task N" references. All code blocks are complete.

### Type consistency

- `SearchBar` interface uses `value: string`, `onChange: (value: string) => void`, `placeholder?: string` — consistent across Task 1 component and Task 2 JSX usage.
- `searchFiltered` is `TagItem[]` — same type as `tags` and `filteredTags` — consistent with `AlphaNav`'s `tags: TagItem[]` prop.
- `handleSearchChange` signature `(value: string) => void` matches `SearchBar`'s `onChange` prop.
