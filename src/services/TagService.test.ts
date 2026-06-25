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

  it("adds target to work items without removing source, then deletes source", async () => {
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
    const source = { id: "old-id", name: "Old", url: "u" };
    const result = await service.mergeTag(source.id, source.name, "New");

    // id 11 already has "New" (case-insensitive) -> unchanged -> skipped.
    expect(result.affectedCount).toBe(1);
    expect(result.workItemIds).toEqual([10]);
    expect(mockWorkItemTrackingClient.updateWorkItem).toHaveBeenCalledTimes(1);

    // PATCH adds target and KEEPS source ("Old" not stripped).
    const patchOps = mockWorkItemTrackingClient.updateWorkItem.mock.calls[0][0] as Array<{
      value: string;
    }>;
    const tagValue = patchOps[0].value.toLowerCase();
    expect(tagValue).toContain("old");
    expect(tagValue).toContain("new");

    // Source removal comes from the cascade delete.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });

  it("runs all additive updates before any source delete (whole-batch atomic)", async () => {
    const order: string[] = [];
    mockWorkItemTrackingClient.queryByWiql
      .mockResolvedValueOnce({ workItems: [{ id: 1 }] })
      .mockResolvedValueOnce({ workItems: [{ id: 2 }] });
    mockWorkItemTrackingClient.getWorkItemsBatch
      .mockResolvedValueOnce([{ id: 1, fields: { "System.Tags": "A" } }])
      .mockResolvedValueOnce([{ id: 2, fields: { "System.Tags": "B" } }]);
    mockWorkItemTrackingClient.updateWorkItem.mockImplementation(async () => {
      order.push("update");
      return {};
    });
    fetchMock.mockImplementation(async () => {
      order.push("delete");
      return createDeleteResponse();
    });

    const service = new TagService();
    await service.mergeTags(
      [
        { id: "a", name: "A", url: "u" },
        { id: "b", name: "B", url: "u" },
      ],
      "Target"
    );

    // Two updates first, then two deletes — no interleaving.
    expect(order).toEqual(["update", "update", "delete", "delete"]);
  });

  it("does not delete a source whose additive update failed", async () => {
    mockWorkItemTrackingClient.queryByWiql
      .mockResolvedValueOnce({ workItems: [{ id: 1 }] })
      .mockResolvedValueOnce({ workItems: [{ id: 2 }] });
    mockWorkItemTrackingClient.getWorkItemsBatch
      .mockResolvedValueOnce([{ id: 1, fields: { "System.Tags": "A" } }])
      .mockResolvedValueOnce([{ id: 2, fields: { "System.Tags": "B" } }]);
    mockWorkItemTrackingClient.updateWorkItem.mockImplementation(async (_ops, id) => {
      if (id === 2) throw new Error("patch failed");
      return {};
    });
    fetchMock.mockResolvedValue(createDeleteResponse());

    const service = new TagService();
    const res = await service.mergeTags(
      [
        { id: "a", name: "A", url: "u" },
        { id: "b", name: "B", url: "u" },
      ],
      "Target"
    );

    expect(res.succeeded.map((s) => s.source.id)).toEqual(["a"]);
    expect(res.failed.map((f) => f.source.id)).toEqual(["b"]);
    // Exactly one DELETE — only for source "a".
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks a source failed when its delete fails after additions succeed", async () => {
    mockWorkItemTrackingClient.queryByWiql.mockResolvedValue({ workItems: [{ id: 1 }] });
    mockWorkItemTrackingClient.getWorkItemsBatch.mockResolvedValue([
      { id: 1, fields: { "System.Tags": "A" } },
    ]);
    mockWorkItemTrackingClient.updateWorkItem.mockResolvedValue({});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => ({}),
      text: async () => "boom",
    });

    const service = new TagService();
    const res = await service.mergeTags([{ id: "a", name: "A", url: "u" }], "Target");

    expect(res.succeeded).toEqual([]);
    expect(res.failed.map((f) => f.source.id)).toEqual(["a"]);
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
