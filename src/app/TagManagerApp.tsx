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
    const failedSourceIds = new Set<string>();
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
