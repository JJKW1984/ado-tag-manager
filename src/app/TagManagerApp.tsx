// src/app/TagManagerApp.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "azure-devops-ui/Card";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import { Page } from "azure-devops-ui/Page";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagService } from "../services/TagService";
import { TagItem, LogEntry } from "../types";
import { TagTable } from "./TagTable";
import { AlphaNav } from "./AlphaNav";
import { DeleteDialog } from "./DeleteDialog";
import { MergeDialog } from "./MergeDialog";
import { CountConfirmDialog } from "./CountConfirmDialog";
import { StatusLog } from "./StatusLog";
import { sanitizeError } from "../utils/sanitizeError";

type DialogState =
  | { type: "delete"; tags: TagItem[] }
  | { type: "merge"; sources: TagItem[] }
  | { type: "countConfirm"; tags: TagItem[] }
  | null;

const tagService = new TagService();
const COUNT_CONFIRM_THRESHOLD = 10;
const PAGE_SIZE = 25;
const LOG_STORAGE_KEY = "ado-tag-manager:activity-log";
const LOG_MAX_ENTRIES = 200;

function loadPersistedLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<LogEntry, "timestamp"> & { timestamp: string }>;
    return parsed.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));
  } catch {
    return [];
  }
}

// Read once at module load so both the initial state and the ID counter seed are consistent.
const _initialLog = loadPersistedLog();
const _initialLogId = _initialLog.length > 0 ? Math.max(..._initialLog.map((e) => e.id)) : 0;

export const TagManagerApp: React.FC = () => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>(_initialLog);
  const [alphaFilter, setAlphaFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const logIdRef = useRef(_initialLogId);

  // Persist log whenever it changes
  useEffect(() => {
    try {
      const toStore = logEntries.slice(-LOG_MAX_ENTRIES);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // localStorage unavailable (e.g. private browsing quota) — silently skip
    }
  }, [logEntries]);

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

  const proj = projectName ? `[${projectName}] ` : "";

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

  useEffect(() => {
    loadTags();
    tagService.getProjectName().then(setProjectName).catch(() => {});
  }, [loadTags]);

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
      const logId = appendLog(`${proj}Deleting "${tag.name}"…`, "running");
      try {
        await tagService.deleteTagById(tag.id);
        updateLog(logId, `${proj}✓ Deleted "${tag.name}"`, "success");
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(tag.id);
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateLog(logId, `${proj}✗ Failed to delete "${tag.name}": ${msg}`, "error");
      }
    }
  };

  const runMergeJobs = async (sources: TagItem[], targetName: string) => {
    setDialog(null);
    const failedSourceIds = new Set<string>();
    for (const source of sources) {
      const logId = appendLog(
        `${proj}Merging "${source.name}" → "${targetName}"…`,
        "running"
      );
      try {
        const result = await tagService.mergeTag(source.id, source.name, targetName);
        updateLog(
          logId,
          `${proj}✓ Merged "${source.name}" → "${targetName}" (${result.affectedCount} work item${result.affectedCount !== 1 ? "s" : ""} updated)`,
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
        updateLog(logId, `${proj}✗ Failed to merge "${source.name}": ${msg}`, "error");
        failedSourceIds.add(source.id);
      }
    }
    // Reload to pick up the new target tag if it was created.
    await loadTags(); // resets selectedIds to empty
    // Re-select any sources that failed to merge so user can retry.
    if (failedSourceIds.size > 0) {
      setSelectedIds(failedSourceIds);
    }
  };

  const runCountJobs = async (tagsToCount: TagItem[]) => {
    setDialog(null);
    // Mark each as counting (-1 sentinel)
    for (const tag of tagsToCount) {
      updateTagCount(tag.id, -1);
    }
    for (const tag of tagsToCount) {
      const logId = appendLog(`${proj}Counting "${tag.name}" across all projects…`, "running");
      try {
        const count = await tagService.countTagAcrossProjects(tag.name);
        updateTagCount(tag.id, count);
        updateLog(logId, `${proj}✓ "${tag.name}" — ${count} work item${count !== 1 ? "s" : ""}`, "success");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateTagCount(tag.id, 0);
        updateLog(logId, `${proj}✗ Failed to count "${tag.name}": ${msg}`, "error");
      }
    }
  };

  // --- Alpha filter + paging ---

  const handleAlphaFilter = (letter: string | null) => {
    setAlphaFilter(letter);
    setCurrentPage(0);
  };

  // --- Render ---

  const filteredTags = alphaFilter
    ? tags.filter((t) => {
        const ch = t.name[0]?.toUpperCase();
        return alphaFilter === "#"
          ? !(ch >= "A" && ch <= "Z")
          : ch === alphaFilter;
      })
    : tags;

  const totalPages = Math.max(1, Math.ceil(filteredTags.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pagedTags = filteredTags.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const n = selectedIds.size;
  const sel = n > 0 ? ` (${n})` : "";
  const commandBarItems: IHeaderCommandBarItem[] = [
    {
      id: "delete",
      text: `Delete${sel}`,
      disabled: n === 0,
      onActivate: handleDeleteClick,
      important: true,
    },
    {
      id: "merge",
      text: `Merge${sel}`,
      disabled: n === 0,
      onActivate: handleMergeClick,
      important: true,
    },
    {
      id: "count",
      text: `Count${sel}`,
      disabled: n === 0,
      onActivate: handleCountClick,
      important: true,
    },
  ];

  return (
    <Page className="tag-manager-page">
      <Header
        title="Tag Manager"
        titleSize={TitleSize.Large}
        description="Manage work item tags across this project."
        commandBarItems={commandBarItems}
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
          <div style={{ display: "flex", flexDirection: "column" }}>
            <AlphaNav
              tags={tags}
              activeFilter={alphaFilter}
              onFilter={handleAlphaFilter}
            />
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                <Spinner size={SpinnerSize.large} label="Loading tags…" />
              </div>
            ) : (
              <TagTable
                tags={pagedTags}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
                onRename={handleRename}
                existingNames={tags.map((t) => t.name)}
              />
            )}
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
                <button
                  disabled={safePage === 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  style={{
                    border: "none", background: "none", cursor: safePage === 0 ? "default" : "pointer",
                    color: safePage === 0 ? "var(--palette-neutral-20, #ccc)" : "var(--communication-foreground, #0078d4)",
                    fontSize: "13px", padding: "2px 4px",
                  }}
                >
                  ← Previous
                </button>
                <span>
                  Page {safePage + 1} of {totalPages}
                  {" "}({filteredTags.length} tag{filteredTags.length !== 1 ? "s" : ""})
                </span>
                <button
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  style={{
                    border: "none", background: "none",
                    cursor: safePage >= totalPages - 1 ? "default" : "pointer",
                    color: safePage >= totalPages - 1 ? "var(--palette-neutral-20, #ccc)" : "var(--communication-foreground, #0078d4)",
                    fontSize: "13px", padding: "2px 4px",
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </Card>
        <StatusLog entries={logEntries} />
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
          allTags={tags}
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
