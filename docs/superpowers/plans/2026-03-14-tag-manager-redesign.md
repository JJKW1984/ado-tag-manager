# Tag Manager Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-row action panel UI with a checkbox-based multi-select table, bulk action bar (Delete / Merge / Count), confirmation dialogs, and a live status log — backed by the `_apis/wit/tags` REST API for all tag mutations.

**Architecture:** Tag list loads from `GET _apis/wit/tags` (one call, no counts). Users select tags via checkboxes, choose an action from the action bar, confirm in a dialog, then watch progress in a bottom status log. Delete and Rename use single-call Tags API endpoints; Merge still patches work items then deletes the source tag; Count queries all org projects via WIQL.

**Tech Stack:** React, TypeScript, azure-devops-extension-sdk, azure-devops-extension-api (WorkItemTrackingRestClient, CoreRestClient), azure-devops-ui components.

---

## Chunk 1: Types + TagService rewrite

### Task 1: Update types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Replace the types file**

```typescript
// src/types/index.ts

/** A tag as returned by GET _apis/wit/tags */
export interface TagItem {
  id: string;
  name: string;
  url: string;
  /** Populated on demand by the Count action */
  count?: number;
}

export interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  status: "info" | "success" | "error" | "running";
}

/** Kept for applyTagUpdate return value (merge) */
export interface TagOperationResult {
  affectedCount: number;
  workItemIds: number[];
}
```

- [ ] **Step 2: Verify TypeScript compiles (expect errors in consumers — that's expected)**

```bash
cd /home/joseph/source/ado-tag-manager && npx tsc --noEmit 2>&1 | head -40
```

---

### Task 2: Rewrite TagService

**Files:**
- Modify: `src/services/TagService.ts`

`★ Insight ─────────────────────────────────────`
- The Tags API (`_apis/wit/tags`) is not wrapped by `WorkItemTrackingRestClient`, so we use `SDK.getAccessToken()` + native `fetch` with a `Bearer` token. The host name comes from `SDK.getHost().name`.
- `CoreRestClient.getProjects()` returns a `PagedList` — it may need to be called in a loop with `continuationToken` for orgs with >100 projects, but `top` defaults to 100, which covers most cases.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Write the new TagService**

```typescript
// src/services/TagService.ts
import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { CoreRestClient } from "azure-devops-extension-api/Core/CoreClient";
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-api/Common/CommonServices";
import { WorkItemBatchGetRequest } from "azure-devops-extension-api/WorkItemTracking";
import { TagItem, TagOperationResult } from "../types";

// ADO stores tags as a semicolon+space separated string: "bug; frontend; P1"
function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw.split(";").map((t) => t.trim()).filter(Boolean);
}

function joinTags(tags: string[]): string {
  return tags.join("; ");
}

export class TagService {
  private async getProject(): Promise<string> {
    const svc = await SDK.getService<IProjectPageService>(
      CommonServiceIds.ProjectPageService
    );
    const project = await svc.getProject();
    if (!project) throw new Error("No project context available");
    return project.name;
  }

  /** Build an authenticated fetch call to the _apis/wit/tags endpoint */
  private async tagsApiRequest<T>(
    method: string,
    project: string,
    suffix = "",
    body?: object
  ): Promise<T> {
    const token = await SDK.getAccessToken();
    const host = SDK.getHost();
    const org = host.name;
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/tags${suffix}?api-version=7.1`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Tags API ${method} ${suffix}: ${res.status} ${text}`);
    }

    // DELETE returns 204 No Content with empty body
    if (method === "DELETE") return undefined as unknown as T;

    return res.json() as Promise<T>;
  }

  /**
   * Returns all tags defined in the current project via the Tags API.
   * No work-item counts are included.
   */
  async getAllTags(): Promise<TagItem[]> {
    const project = await this.getProject();
    const data = await this.tagsApiRequest<{ value: TagItem[] }>(
      "GET",
      project
    );
    return (data.value ?? []).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Deletes a tag from the project by its ID (or name).
   * ADO cascades removal from all work items and PRs automatically.
   */
  async deleteTagById(tagIdOrName: string): Promise<void> {
    const project = await this.getProject();
    await this.tagsApiRequest<void>(
      "DELETE",
      project,
      `/${encodeURIComponent(tagIdOrName)}`
    );
  }

  /**
   * Renames a tag via the Tags API (single call, reflected everywhere).
   */
  async renameTagById(tagId: string, newName: string): Promise<TagItem> {
    const project = await this.getProject();
    return this.tagsApiRequest<TagItem>(
      "PATCH",
      project,
      `/${encodeURIComponent(tagId)}`,
      { name: newName }
    );
  }

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

  /**
   * Returns the IDs of all work items that contain the given tag in the current project.
   */
  async getWorkItemsWithTag(tag: string): Promise<number[]> {
    const project = await this.getProject();
    const client = getClient(WorkItemTrackingRestClient);
    const escaped = tag.replace(/'/g, "''");
    const result = await client.queryByWiql(
      {
        query: `SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS '${escaped}' AND [System.TeamProject] = @project ORDER BY [System.Id]`,
      },
      project
    );
    return (result.workItems ?? []).map((wi) => wi.id);
  }

  /**
   * Merges sourceTag into targetTag in the current project:
   * 1. Patches all work items with sourceTag to add targetTag and remove sourceTag.
   * 2. Deletes the source tag definition via the Tags API.
   */
  async mergeTag(
    sourceId: string,
    sourceName: string,
    targetName: string
  ): Promise<TagOperationResult> {
    const ids = await this.getWorkItemsWithTag(sourceName);
    const result = await this.applyTagUpdate(ids, (tags) => {
      const without = tags.filter(
        (t) => t.toLowerCase() !== sourceName.toLowerCase()
      );
      const hasTarget = without.some(
        (t) => t.toLowerCase() === targetName.toLowerCase()
      );
      return hasTarget ? without : [...without, targetName];
    });
    await this.deleteTagById(sourceId);
    return result;
  }

  /**
   * Fetches each work item, applies the tag transform, and PATCHes only changed items.
   */
  private async applyTagUpdate(
    workItemIds: number[],
    transform: (tags: string[]) => string[]
  ): Promise<TagOperationResult> {
    if (workItemIds.length === 0) return { affectedCount: 0, workItemIds: [] };

    const project = await this.getProject();
    const client = getClient(WorkItemTrackingRestClient);
    const affectedIds: number[] = [];

    const workItemMap = new Map<number, string>();
    for (let i = 0; i < workItemIds.length; i += 200) {
      const batch = workItemIds.slice(i, i + 200);
      const workItems = await client.getWorkItemsBatch(
        { ids: batch, fields: ["System.Tags"] } as WorkItemBatchGetRequest,
        project
      );
      for (const wi of workItems) {
        workItemMap.set(wi.id, (wi.fields?.["System.Tags"] as string) ?? "");
      }
    }

    for (const [id, rawTags] of workItemMap.entries()) {
      const original = parseTags(rawTags);
      const updated = transform(original);
      const normalizedOriginal = [...new Set(original)].sort().join(";");
      const normalizedUpdated = [...new Set(updated)].sort().join(";");
      if (normalizedOriginal === normalizedUpdated) continue;

      await client.updateWorkItem(
        [{ op: "add", path: "/fields/System.Tags", value: joinTags([...new Set(updated)]) }],
        id,
        project
      );
      affectedIds.push(id);
    }

    return { affectedCount: affectedIds.length, workItemIds: affectedIds };
  }
}
```

- [ ] **Step 2: Verify TS compiles (expect remaining errors only in UI files)**

```bash
cd /home/joseph/source/ado-tag-manager && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/types/index.ts src/services/TagService.ts
git commit -m "refactor: replace WIQL tag loading and mutations with Tags REST API"
```

---

## Chunk 2: New UI components

### Task 3: TagTable component (replaces TagList)

**Files:**
- Create: `src/app/TagTable.tsx`
- Delete: `src/app/TagList.tsx` (after TagManagerApp is updated)

`★ Insight ─────────────────────────────────────`
- The azure-devops-ui `Table` uses `ObservableValue` and `ArrayItemProvider` for reactive updates. For checkbox selection the `ISelectionRange`-based `Selection` class from `azure-devops-ui/Utilities/Selection` tracks selected rows by index.
- Storing selected IDs in React state (a `Set<string>`) is simpler and more reliable than reading back from the ADO UI selection object, because the table items may be re-ordered.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Create TagTable**

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

interface TagTableProps {
  tags: TagItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (select: boolean) => void;
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
}) => {
  if (tags.length === 0) {
    return (
      <ZeroData
        primaryText="No tags found"
        secondaryText="This project has no work item tags yet."
        imageAltText="No tags"
        imagePath=""
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
            onChange={(_e, checked) => onToggle(item.id)}
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
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={(_e, checked) => onToggleAll(checked)}
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
          {item.name}
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
  ], [selectedIds, onToggle, onToggleAll, allSelected, someSelected]);

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

Note: `count === -1` is used as a sentinel for "counting in progress" on a specific row.

- [ ] **Step 2: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/app/TagTable.tsx
git commit -m "feat: add TagTable with checkbox selection and on-demand count column"
```

---

### Task 4: ActionBar component

**Files:**
- Create: `src/app/ActionBar.tsx`

- [ ] **Step 1: Create ActionBar**

```typescript
// src/app/ActionBar.tsx
import React from "react";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";

interface ActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onMerge: () => void;
  onCount: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  selectedCount,
  onDelete,
  onMerge,
  onCount,
}) => {
  const disabled = selectedCount === 0;
  const label = selectedCount > 0 ? ` (${selectedCount})` : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 0",
      }}
    >
      <ButtonGroup>
        <Button
          text={`Delete${label}`}
          danger
          disabled={disabled}
          onClick={onDelete}
        />
        <Button
          text={`Merge${label}`}
          disabled={disabled}
          onClick={onMerge}
        />
        <Button
          text={`Count${label}`}
          subtle
          disabled={disabled}
          onClick={onCount}
        />
      </ButtonGroup>
      {selectedCount > 0 && (
        <span style={{ color: "var(--palette-neutral-30, #888)", fontSize: "12px" }}>
          {selectedCount} tag{selectedCount !== 1 ? "s" : ""} selected
        </span>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/app/ActionBar.tsx
git commit -m "feat: add ActionBar with Delete / Merge / Count bulk action buttons"
```

---

### Task 5: DeleteDialog component

**Files:**
- Create: `src/app/DeleteDialog.tsx`
- Delete: `src/app/DeletePanel.tsx` (after TagManagerApp updated)

- [ ] **Step 1: Create DeleteDialog**

```typescript
// src/app/DeleteDialog.tsx
import React from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
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
      <ul style={{ margin: "12px 0 0 0", paddingLeft: "20px" }}>
        {tags.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong>
          </li>
        ))}
      </ul>
    </Dialog>
  );
};
```

- [ ] **Step 2: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/app/DeleteDialog.tsx
git commit -m "feat: add DeleteDialog confirmation for bulk tag deletion"
```

---

### Task 6: MergeDialog component

**Files:**
- Create: `src/app/MergeDialog.tsx`
- Delete: `src/app/MergePanel.tsx`, `src/app/RenamePanel.tsx` (after TagManagerApp updated)

- [ ] **Step 1: Create MergeDialog**

```typescript
// src/app/MergeDialog.tsx
import React, { useState } from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { TextField, TextFieldWidth } from "azure-devops-ui/TextField";
import { FormItem } from "azure-devops-ui/FormItem";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagItem } from "../types";

interface MergeDialogProps {
  sources: TagItem[];
  onConfirm: (targetName: string) => void;
  onCancel: () => void;
}

export const MergeDialog: React.FC<MergeDialogProps> = ({
  sources,
  onConfirm,
  onCancel,
}) => {
  const [targetName, setTargetName] = useState("");
  const isValid = targetName.trim().length > 0;

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
          onClick: () => onConfirm(targetName.trim()),
        },
      ]}
      onDismiss={onCancel}
    >
      <MessageCard severity={MessageCardSeverity.Warning}>
        The following tag{sources.length !== 1 ? "s" : ""} will be merged into
        the target and removed from the project.
      </MessageCard>
      <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
        {sources.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong>
          </li>
        ))}
      </ul>
      <FormItem label="Target tag (type to create or match existing)">
        <TextField
          value={targetName}
          onChange={(_e, val) => setTargetName(val)}
          placeholder="Enter target tag name"
          width={TextFieldWidth.standard}
        />
      </FormItem>
    </Dialog>
  );
};
```

- [ ] **Step 2: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/app/MergeDialog.tsx
git commit -m "feat: add MergeDialog with free-text target input for bulk merge"
```

---

### Task 7: CountConfirmDialog component

**Files:**
- Create: `src/app/CountConfirmDialog.tsx`

- [ ] **Step 1: Create CountConfirmDialog**

```typescript
// src/app/CountConfirmDialog.tsx
import React from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagItem } from "../types";

interface CountConfirmDialogProps {
  tags: TagItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const CountConfirmDialog: React.FC<CountConfirmDialogProps> = ({
  tags,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      titleProps={{ text: "Count Work Items" }}
      footerButtonProps={[
        { text: "Cancel", onClick: onCancel },
        {
          text: `Count ${tags.length} tags`,
          primary: true,
          onClick: onConfirm,
        },
      ]}
      onDismiss={onCancel}
    >
      <MessageCard severity={MessageCardSeverity.Info}>
        You've selected <strong>{tags.length} tags</strong>. Counting work items
        across all projects may take a while depending on the size of your
        organisation. Do you want to continue?
      </MessageCard>
    </Dialog>
  );
};
```

- [ ] **Step 2: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/app/CountConfirmDialog.tsx
git commit -m "feat: add CountConfirmDialog for large bulk count operations"
```

---

### Task 8: StatusLog component

**Files:**
- Create: `src/app/StatusLog.tsx`

- [ ] **Step 1: Create StatusLog**

```typescript
// src/app/StatusLog.tsx
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
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && entries.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, collapsed]);

  if (entries.length === 0) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--palette-neutral-10, #eee)",
        marginTop: "16px",
        fontFamily: "monospace",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 0",
          cursor: "pointer",
          userSelect: "none",
          color: "var(--palette-neutral-60, #555)",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>{collapsed ? "▶" : "▼"}</span>
        <span>
          Activity Log ({entries.length} entr{entries.length !== 1 ? "ies" : "y"})
        </span>
      </div>

      {!collapsed && (
        <div
          style={{
            maxHeight: "200px",
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {entries.map((e) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                gap: "8px",
                padding: "2px 0",
                color: STATUS_COLORS[e.status],
              }}
            >
              <span style={{ minWidth: "60px", color: "var(--palette-neutral-30, #aaa)" }}>
                {e.timestamp.toLocaleTimeString()}
              </span>
              <span style={{ minWidth: "16px" }}>{STATUS_ICONS[e.status]}</span>
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

- [ ] **Step 2: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/app/StatusLog.tsx
git commit -m "feat: add StatusLog collapsible panel with live activity entries"
```

---

## Chunk 3: TagManagerApp rewrite + cleanup

### Task 9: Rewrite TagManagerApp

**Files:**
- Modify: `src/app/TagManagerApp.tsx`

This is the main orchestrator. It owns all state and dispatches background jobs.

`★ Insight ─────────────────────────────────────`
- "Background jobs" in a browser extension = async functions that update React state via callbacks. Jobs for write operations (delete, merge) run sequentially to avoid ADO rate limits. Count jobs run per-tag sequentially within the batch but update the table row live as each tag resolves.
- Using a monotonic `logIdRef` (via `useRef`) for log entry IDs avoids stale closure issues that would occur if you derived IDs from `logEntries.length`.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Write TagManagerApp**

```typescript
// src/app/TagManagerApp.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "azure-devops-ui/Card";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagService } from "../services/TagService";
import { TagItem, LogEntry } from "../types";
import { TagTable } from "./TagTable";
import { ActionBar } from "./ActionBar";
import { DeleteDialog } from "./DeleteDialog";
import { MergeDialog } from "./MergeDialog";
import { CountConfirmDialog } from "./CountConfirmDialog";
import { StatusLog } from "./StatusLog";

type DialogState =
  | { type: "delete"; tags: TagItem[] }
  | { type: "merge"; sources: TagItem[] }
  | { type: "countConfirm"; tags: TagItem[] }
  | null;

const tagService = new TagService();
const COUNT_CONFIRM_THRESHOLD = 10;

export const TagManagerApp: React.FC = () => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  // --- Helpers ---

  const appendLog = useCallback((message: string, status: LogEntry["status"]): number => {
    const id = ++logIdRef.current;
    setLogEntries((prev) => [
      ...prev,
      { id, timestamp: new Date(), message, status },
    ]);
    return id;
  }, []);

  const updateLog = useCallback((id: number, message: string, status: LogEntry["status"]) => {
    setLogEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, message, status } : e))
    );
  }, []);

  const updateTagCount = useCallback((tagId: string, count: number) => {
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, count } : t))
    );
  }, []);

  // --- Data loading ---

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tagService.getAllTags();
      setTags(result);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTags(); }, [loadTags]);

  // --- Selection ---

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((select: boolean) => {
    setSelectedIds(select ? new Set(tags.map((t) => t.id)) : new Set());
  }, [tags]);

  // --- Action triggers (open dialogs) ---

  const handleDeleteClick = () => {
    const selected = tags.filter((t) => selectedIds.has(t.id));
    setDialog({ type: "delete", tags: selected });
  };

  const handleMergeClick = () => {
    const selected = tags.filter((t) => selectedIds.has(t.id));
    setDialog({ type: "merge", sources: selected });
  };

  const handleCountClick = () => {
    const selected = tags.filter((t) => selectedIds.has(t.id));
    if (selected.length > COUNT_CONFIRM_THRESHOLD) {
      setDialog({ type: "countConfirm", tags: selected });
    } else {
      runCountJobs(selected);
    }
  };

  // --- Background jobs ---

  const runDeleteJobs = async (tagsToDelete: TagItem[]) => {
    setDialog(null);
    for (const tag of tagsToDelete) {
      const logId = appendLog(`Deleting "${tag.name}"…`, "running");
      try {
        await tagService.deleteTagById(tag.id);
        updateLog(logId, `✓ Deleted "${tag.name}"`, "success");
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(tag.id);
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateLog(logId, `✗ Failed to delete "${tag.name}": ${msg}`, "error");
      }
    }
  };

  const runMergeJobs = async (sources: TagItem[], targetName: string) => {
    setDialog(null);
    for (const source of sources) {
      const logId = appendLog(
        `Merging "${source.name}" → "${targetName}"…`,
        "running"
      );
      try {
        const result = await tagService.mergeTag(source.id, source.name, targetName);
        updateLog(
          logId,
          `✓ Merged "${source.name}" → "${targetName}" (${result.affectedCount} work item${result.affectedCount !== 1 ? "s" : ""} updated)`,
          "success"
        );
        setTags((prev) => prev.filter((t) => t.id !== source.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(source.id);
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateLog(logId, `✗ Failed to merge "${source.name}": ${msg}`, "error");
      }
    }
    // Reload to pick up the new target tag if it was created.
    // Preserve any IDs that are still in the tag list (failed merges stay selected).
    const removedIds = sources.map((s) => s.id);
    await loadTags(); // resets selectedIds to empty
    setSelectedIds((prev) => {
      // Re-select any source IDs that are still present after reload
      // (i.e., ones that failed to merge — they won't be in the new tag list
      // so this effectively selects nothing, but if a source somehow survived
      // it will remain selected for retry)
      return new Set([...prev].filter((id) => removedIds.includes(id)));
    });
  };

  const runCountJobs = async (tagsToCount: TagItem[]) => {
    setDialog(null);
    // Mark each as counting
    for (const tag of tagsToCount) {
      updateTagCount(tag.id, -1);
    }
    for (const tag of tagsToCount) {
      const logId = appendLog(`Counting "${tag.name}" across all projects…`, "running");
      try {
        const count = await tagService.countTagAcrossProjects(tag.name);
        updateTagCount(tag.id, count);
        updateLog(logId, `✓ "${tag.name}" — ${count} work item${count !== 1 ? "s" : ""}`, "success");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateTagCount(tag.id, 0);
        updateLog(logId, `✗ Failed to count "${tag.name}": ${msg}`, "error");
      }
    }
  };

  // --- Render ---

  const selectedTags = tags.filter((t) => selectedIds.has(t.id));

  return (
    <Page className="tag-manager-page">
      <Header
        title="Tag Manager"
        titleSize={TitleSize.Large}
        description="Manage work item tags across this project."
      />
      <div className="page-content">
        {error && (
          <MessageCard
            className="tag-manager-error"
            severity={MessageCardSeverity.Error}
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageCard>
        )}
        <Card>
          <ActionBar
            selectedCount={selectedIds.size}
            onDelete={handleDeleteClick}
            onMerge={handleMergeClick}
            onCount={handleCountClick}
          />
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
              <Spinner size={SpinnerSize.large} label="Loading tags…" />
            </div>
          ) : (
            <TagTable
              tags={tags}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
            />
          )}
          <StatusLog entries={logEntries} />
        </Card>
      </div>

      {dialog?.type === "delete" && (
        <DeleteDialog
          tags={dialog.tags}
          onConfirm={() => runDeleteJobs(dialog.tags)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === "merge" && (
        <MergeDialog
          sources={dialog.sources}
          onConfirm={(targetName) => runMergeJobs(dialog.sources, targetName)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === "countConfirm" && (
        <CountConfirmDialog
          tags={dialog.tags}
          onConfirm={() => runCountJobs(dialog.tags)}
          onCancel={() => setDialog(null)}
        />
      )}
    </Page>
  );
};
```

- [ ] **Step 2: Verify TS compiles cleanly**

```bash
cd /home/joseph/source/ado-tag-manager && npx tsc --noEmit 2>&1
```

Fix any errors before committing.

- [ ] **Step 3: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add src/app/TagManagerApp.tsx
git commit -m "feat: rewrite TagManagerApp with checkbox selection, action bar, dialogs, and status log"
```

---

### Task 10: Remove obsolete files

**Files:**
- Delete: `src/app/TagList.tsx`
- Delete: `src/app/DeletePanel.tsx`
- Delete: `src/app/MergePanel.tsx`
- Delete: `src/app/RenamePanel.tsx`

- [ ] **Step 1: Delete old panel and list files**

```bash
cd /home/joseph/source/ado-tag-manager
rm src/app/TagList.tsx src/app/DeletePanel.tsx src/app/MergePanel.tsx src/app/RenamePanel.tsx
```

- [ ] **Step 2: Verify TS still compiles cleanly**

```bash
cd /home/joseph/source/ado-tag-manager && npx tsc --noEmit 2>&1
```

- [ ] **Step 3: Build**

```bash
cd /home/joseph/source/ado-tag-manager && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /home/joseph/source/ado-tag-manager
git add -A
git commit -m "chore: remove obsolete TagList, DeletePanel, MergePanel, RenamePanel"
```

---

## Verification

1. `npm run build` completes with no errors.
2. Load the extension in an ADO project:
   - Hub loads showing tag list (no counts column, just names)
   - Checkboxes appear per row + select-all in header
   - Action buttons are disabled with 0 selected; enable when ≥1 selected
3. **Delete**: select tags → Delete button → confirmation dialog lists them → confirm → status log shows "Deleting X… ✓ Deleted X" → rows disappear
4. **Merge**: select tags → Merge → type target name → confirm → log shows merge progress → source rows removed, tag list reloads
5. **Count**: select ≤10 tags → Count → log shows "Counting X across all projects… ✓ X — N work items" → count appears inline in the table row
6. **Count confirm**: select >10 tags → Count → confirmation dialog appears first
7. **Error handling**: if a delete/merge/count fails, log shows red ✗ entry; other selected tags continue processing
