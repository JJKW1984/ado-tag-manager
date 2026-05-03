// src/services/TagCountCacheService.ts
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IExtensionDataService } from "azure-devops-extension-api/Common/CommonServices";
import { TagCountCache } from "../types";

const CACHE_KEY = "orgTagCounts";
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export class TagCountCacheService {
  private async getDataManager() {
    const dataService = await SDK.getService<IExtensionDataService>(
      CommonServiceIds.ExtensionDataService
    );
    const extensionId = SDK.getExtensionContext().id;
    const token = await SDK.getAccessToken();
    return dataService.getExtensionDataManager(extensionId, token);
  }

  async getCache(): Promise<TagCountCache | null> {
    const manager = await this.getDataManager();
    const value = await manager.getValue<TagCountCache>(CACHE_KEY, { scopeType: "Default" });
    return value ?? null;
  }

  async setCache(cache: TagCountCache): Promise<void> {
    const manager = await this.getDataManager();
    await manager.setValue(CACHE_KEY, cache, { scopeType: "Default" });
  }

  async fetchCounts(orgName: string): Promise<Record<string, number>> {
    const token = await SDK.getAccessToken();
    const counts: Record<string, number> = {};
    let url: string | null =
      `https://analytics.dev.azure.com/${encodeURIComponent(orgName)}/_odata/v4.0-preview/WorkItems` +
      `?$select=WorkItemId&$expand=Tags($select=TagName)&$filter=Tags/any()`;

    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Analytics OData: ${res.status} ${text}`);
      }
      const data = await res.json() as {
        value: Array<{ Tags: Array<{ TagName: string | null }> | null }>;
        "@odata.nextLink"?: string;
      };
      for (const item of data.value ?? []) {
        for (const tag of item.Tags ?? []) {
          if (tag?.TagName) {
            const name = tag.TagName.toLowerCase();
            counts[name] = (counts[name] ?? 0) + 1;
          }
        }
      }
      url = data["@odata.nextLink"] ?? null;
    }
    return counts;
  }

  async refreshCache(orgName: string): Promise<TagCountCache> {
    const counts = await this.fetchCounts(orgName);
    const cache: TagCountCache = { counts, lastUpdated: new Date().toISOString() };
    await this.setCache(cache);
    return cache;
  }

  isStaleCacheOrMissing(cache: TagCountCache | null): boolean {
    if (!cache) return true;
    const ts = new Date(cache.lastUpdated).getTime();
    if (Number.isNaN(ts)) return true;
    return Date.now() - ts > STALE_THRESHOLD_MS;
  }
}
