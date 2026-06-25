// src/types/index.ts

/** A tag as returned by GET _apis/wit/tags */
export interface TagItem {
  id: string;
  name: string;
  url: string;
  /** Populated from the org-wide count cache */
  count?: number;
}

/** Kept for applyTagUpdate return value (merge) */
export interface TagOperationResult {
  affectedCount: number;
  workItemIds: number[];
}

/** Org-wide tag count cache stored via IExtensionDataService */
export interface TagCountCache {
  counts: Record<string, number>;  // tag name (lowercase) → work item count
  lastUpdated: string;              // ISO 8601 timestamp
}

/** One source tag successfully merged into the target. */
export interface MergeSourceResult extends TagOperationResult {
  source: TagItem;
}

/** One source tag that failed to merge (kept for retry). */
export interface MergeSourceFailure {
  source: TagItem;
  error: string;
}

/** Result of merging one or more source tags into a target. */
export interface BatchMergeResult {
  succeeded: MergeSourceResult[];
  failed: MergeSourceFailure[];
}
