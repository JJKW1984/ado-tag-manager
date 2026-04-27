import { TagCountCacheService } from "./TagCountCacheService";
import {
  mockGetService,
  mockGetAccessToken,
  mockExtensionDataManager,
  mockExtensionDataService,
} from "../test/mocks/azureDevopsSdkMock";

describe("TagCountCacheService", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockGetService.mockResolvedValue(mockExtensionDataService);
  });

  // --- getCache ---

  it("returns null when no value is stored", async () => {
    mockExtensionDataManager.getValue.mockResolvedValue(undefined);

    const service = new TagCountCacheService();
    const result = await service.getCache();

    expect(result).toBeNull();
  });

  it("returns stored cache when present", async () => {
    const stored = { counts: { bug: 5 }, lastUpdated: "2026-04-26T10:00:00.000Z" };
    mockExtensionDataManager.getValue.mockResolvedValue(stored);

    const service = new TagCountCacheService();
    const result = await service.getCache();

    expect(result).toEqual(stored);
  });

  it("reads with key 'orgTagCounts' and Default scope", async () => {
    mockExtensionDataManager.getValue.mockResolvedValue(undefined);

    const service = new TagCountCacheService();
    await service.getCache();

    expect(mockExtensionDataManager.getValue).toHaveBeenCalledWith(
      "orgTagCounts",
      { scopeType: "Default" }
    );
  });

  // --- setCache ---

  it("writes cache with key 'orgTagCounts' and Default scope", async () => {
    mockExtensionDataManager.setValue.mockResolvedValue(undefined);
    const cache = { counts: { bug: 3 }, lastUpdated: "2026-04-26T10:00:00.000Z" };

    const service = new TagCountCacheService();
    await service.setCache(cache);

    expect(mockExtensionDataManager.setValue).toHaveBeenCalledWith(
      "orgTagCounts",
      cache,
      { scopeType: "Default" }
    );
  });

  // --- fetchCounts ---

  it("calls Analytics OData with bearer token and normalizes tag names to lowercase", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          { Tags: [{ TagName: "Bug" }, { TagName: "Feature" }] },
          { Tags: [{ TagName: "Bug" }] },
        ],
      }),
    });

    const service = new TagCountCacheService();
    const counts = await service.fetchCounts("my-org");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("analytics.dev.azure.com/my-org");
    expect(url).toContain("$expand=Tags");
    expect(url).toContain("$filter=Tags/any()");
    expect((options.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-access-token"
    );
    expect(counts).toEqual({ bug: 2, feature: 1 });
  });

  it("skips entries with null Tags or null TagName", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          { Tags: [{ TagName: "ops" }] },
          { Tags: null },
          { Tags: [{ TagName: null }] },
        ],
      }),
    });

    const service = new TagCountCacheService();
    const counts = await service.fetchCounts("my-org");

    expect(counts).toEqual({ ops: 1 });
  });

  it("follows @odata.nextLink to aggregate across pages", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ Tags: [{ TagName: "bug" }] }],
          "@odata.nextLink": "https://analytics.dev.azure.com/my-org/_odata/v4.0-preview/WorkItems?$skiptoken=abc",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ Tags: [{ TagName: "bug" }, { TagName: "feature" }] }],
        }),
      });

    const service = new TagCountCacheService();
    const counts = await service.fetchCounts("my-org");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(counts).toEqual({ bug: 2, feature: 1 });
  });

  it("throws on non-OK response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Access denied",
    });

    const service = new TagCountCacheService();
    await expect(service.fetchCounts("my-org")).rejects.toThrow("403");
  });

  // --- refreshCache ---

  it("fetches counts, stores cache, and returns the new cache object", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [{ Tags: [{ TagName: "ops" }] }],
      }),
    });
    mockExtensionDataManager.setValue.mockResolvedValue(undefined);

    const service = new TagCountCacheService();
    const result = await service.refreshCache("my-org");

    expect(result.counts).toEqual({ ops: 1 });
    expect(result.lastUpdated).toBeDefined();
    expect(new Date(result.lastUpdated).getTime()).toBeGreaterThan(0);
    expect(mockExtensionDataManager.setValue).toHaveBeenCalledWith(
      "orgTagCounts",
      expect.objectContaining({ counts: { ops: 1 } }),
      { scopeType: "Default" }
    );
  });

  // --- isStaleCacheOrMissing ---

  it("returns true when cache is null", () => {
    const service = new TagCountCacheService();
    expect(service.isStaleCacheOrMissing(null)).toBe(true);
  });

  it("returns true when lastUpdated is more than 24 hours ago", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const service = new TagCountCacheService();
    expect(service.isStaleCacheOrMissing({ counts: {}, lastUpdated: old })).toBe(true);
  });

  it("returns false when lastUpdated is less than 24 hours ago", () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    const service = new TagCountCacheService();
    expect(service.isStaleCacheOrMissing({ counts: {}, lastUpdated: recent })).toBe(false);
  });
});
