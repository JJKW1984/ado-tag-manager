// src/app/TagManagerApp.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "azure-devops-ui/Card";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import { Page } from "azure-devops-ui/Page";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";
import { TagService } from "../services/TagService";
import { TagItem } from "../types";
import { TagTable } from "./TagTable";
import { AlphaNav } from "./AlphaNav";
import { DeleteDialog } from "./DeleteDialog";
import { MergeDialog } from "./MergeDialog";
import { CountConfirmDialog } from "./CountConfirmDialog";
import "./tag-manager.css";
import { SearchBar } from "./SearchBar";
import { sanitizeError } from "../utils/sanitizeError";

type DialogState =
  | { type: "delete"; tags: TagItem[] }
  | { type: "merge"; sources: TagItem[] }
  | { type: "countConfirm"; tags: TagItem[] }
  | null;

const tagService = new TagService();
const COUNT_CONFIRM_THRESHOLD = 10;
const PAGE_SIZE = 25;

export const TagManagerApp: React.FC = () => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [alphaFilter, setAlphaFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const tagsRef = useRef<TagItem[]>([]);

  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  // --- Helpers ---

  const updateTagCount = useCallback((tagId: string, count: number) => {
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, count } : t))
    );
  }, []);

  const handleRename = useCallback(async (tagId: string, newName: string) => {
    try {
      const updated = await tagService.renameTagById(tagId, newName);
      setTags((prev) =>
        prev
          .map((t) => (t.id === tagId ? { ...t, name: updated.name } : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      setError(sanitizeError(e));
    }
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

  useEffect(() => {
    loadTags();
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
      try {
        await tagService.deleteTagById(tag.id);
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(tag.id);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const runMergeJobs = async (sources: TagItem[], targetName: string) => {
    setDialog(null);
    const failedSourceIds = new Set<string>();
    for (const source of sources) {
      try {
        await tagService.mergeTag(source.id, source.name, targetName);
        setTags((prev) => prev.filter((t) => t.id !== source.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(source.id);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
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
      try {
        const count = await tagService.countTagAcrossProjects(tag.name);
        updateTagCount(tag.id, count);
      } catch (e) {
        updateTagCount(tag.id, 0);
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  // --- Alpha filter + paging ---

  const handleAlphaFilter = (letter: string | null) => {
    setAlphaFilter(letter);
    setCurrentPage(0);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
  };

  // --- Render ---

  const searchFiltered = searchQuery.trim()
    ? tags.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : tags;
  const existingNames = useMemo(() => tags.map((t) => t.name), [tags]);

  const filteredTags = alphaFilter
    ? searchFiltered.filter((t) => {
        const ch = t.name[0]?.toUpperCase();
        return alphaFilter === "#"
          ? !(ch >= "A" && ch <= "Z")
          : ch === alphaFilter;
      })
    : searchFiltered;

  const totalPages = Math.max(1, Math.ceil(filteredTags.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pagedTags = filteredTags.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const n = selectedIds.size;
  const sel = n > 0 ? ` (${n})` : "";
  const commandBarItems: IHeaderCommandBarItem[] = [
    {
      id: "delete",
      text: `Delete${sel}`,
      iconProps: { iconName: "Delete" },
      disabled: n === 0,
      onActivate: handleDeleteClick,
      important: true,
    },
    {
      id: "merge",
      text: `Merge${sel}`,
      iconProps: { iconName: "BranchMerge" },
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
            className="tm-error-card"
            severity={MessageCardSeverity.Error}
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageCard>
        )}
        <Card>
          <div className="tm-card-content">
            <SearchBar value={searchQuery} onChange={handleSearchChange} />
            <AlphaNav
              tags={searchFiltered}
              activeFilter={alphaFilter}
              onFilter={handleAlphaFilter}
            />
            {loading ? (
              <div className="tm-spinner-wrapper">
                <Spinner size={SpinnerSize.large} label="Loading tags…" />
              </div>
            ) : (
              <TagTable
                tags={pagedTags}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
                onRename={handleRename}
                existingNames={existingNames}
              />
            )}
            {!loading && totalPages > 1 && (
              <div className="tm-pagination">
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
          </div>
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
