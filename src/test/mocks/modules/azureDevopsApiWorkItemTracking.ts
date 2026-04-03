export class WorkItemTrackingRestClient {}

export interface WorkItemBatchGetRequest {
  ids: number[];
  fields?: string[];
}
