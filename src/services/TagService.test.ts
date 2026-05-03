import { TagService } from "./TagService";

import { mockWorkItemTrackingClient } from "../test/mocks/azureDevopsApiMock";
import { setMockProject } from "../test/mocks/azureDevopsSdkMock";

type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function createJsonResponse(payload: unknown): MockResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function createDeleteResponse(): MockResponse {
  return {
    ok: true,
    status: 204,
    statusText: "No Content",
    json: async () => undefined,
    text: async () => "",
  };
}

describe("TagService", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    setMockProject("Demo Project");
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("loads and sorts tags by name", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        value: [
          { id: "2", name: "zeta", url: "u2" },
          { id: "1", name: "alpha", url: "u1" },
        ],
      })
    );

    const service = new TagService();
    const result = await service.getAllTags();

    expect(result.map((t) => t.name)).toEqual(["alpha", "zeta"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET" });
  });

  it("deletes a tag by id", async () => {
    fetchMock.mockResolvedValue(createDeleteResponse());

    const service = new TagService();
    await service.deleteTagById("tag-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });

  it("renames a tag by id", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({ id: "tag-1", name: "backend", url: "u" })
    );

    const service = new TagService();
    const result = await service.renameTagById("tag-1", "backend");

    expect(result.name).toBe("backend");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PATCH" });
  });

  it("returns work item ids that contain a tag", async () => {
    mockWorkItemTrackingClient.queryByWiql.mockResolvedValue({
      workItems: [{ id: 100 }, { id: 101 }],
    });

    const service = new TagService();
    const ids = await service.getWorkItemsWithTag("ops");

    expect(ids).toEqual([100, 101]);
  });

  it("merges source tags into target and deletes source tag", async () => {
    mockWorkItemTrackingClient.queryByWiql.mockResolvedValue({
      workItems: [{ id: 10 }, { id: 11 }],
    });

    mockWorkItemTrackingClient.getWorkItemsBatch.mockResolvedValue([
      { id: 10, fields: { "System.Tags": "Old; Alpha" } },
      { id: 11, fields: { "System.Tags": "old; New" } },
    ]);

    mockWorkItemTrackingClient.updateWorkItem.mockResolvedValue({});
    fetchMock.mockResolvedValue(createDeleteResponse());

    const service = new TagService();
    const result = await service.mergeTag("old-id", "Old", "New");

    expect(result.affectedCount).toBe(2);
    expect(result.workItemIds).toEqual([10, 11]);
    expect(mockWorkItemTrackingClient.updateWorkItem).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });

  it("does not patch work items when transformed tag set is unchanged", async () => {
    const service = new TagService();

    mockWorkItemTrackingClient.getWorkItemsBatch.mockResolvedValue([
      { id: 1, fields: { "System.Tags": "A; B" } },
    ]);

    const result = await (service as unknown as {
      applyTagUpdate: (
        ids: number[],
        transform: (tags: string[]) => string[]
      ) => Promise<{ affectedCount: number; workItemIds: number[] }>;
    }).applyTagUpdate([1], (tags) => [...tags].reverse());

    expect(result).toEqual({ affectedCount: 0, workItemIds: [] });
    expect(mockWorkItemTrackingClient.updateWorkItem).not.toHaveBeenCalled();
  });

  it("loads work items in batches of 200 for updates", async () => {
    const ids = Array.from({ length: 205 }, (_v, i) => i + 1);
    const service = new TagService();

    mockWorkItemTrackingClient.getWorkItemsBatch.mockImplementation(
      async (request: unknown) =>
        (request as { ids: number[] }).ids.map((id) => ({
          id,
          fields: { "System.Tags": "" },
        }))
    );

    await (service as unknown as {
      applyTagUpdate: (
        workItemIds: number[],
        transform: (tags: string[]) => string[]
      ) => Promise<unknown>;
    }).applyTagUpdate(ids, () => ["X"]);

    expect(mockWorkItemTrackingClient.getWorkItemsBatch).toHaveBeenCalledTimes(2);
    expect(mockWorkItemTrackingClient.updateWorkItem).toHaveBeenCalledTimes(205);
  });

  it("throws when project context is unavailable", async () => {
    setMockProject(null);

    const service = new TagService();

    await expect(service.getProjectName()).rejects.toThrow(
      "No project context available"
    );
  });
});
