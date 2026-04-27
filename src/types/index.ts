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
