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
