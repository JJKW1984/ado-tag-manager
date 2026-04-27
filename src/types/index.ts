// src/types/index.ts

/** A tag as returned by GET _apis/wit/tags */
export interface TagItem {
  id: string;
  name: string;
  url: string;
  /** Populated on demand by the Count action */
  count?: number;
}

/** Kept for applyTagUpdate return value (merge) */
export interface TagOperationResult {
  affectedCount: number;
  workItemIds: number[];
}
