import { CoreRestClient } from "azure-devops-extension-api/Core/CoreClient";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";

type ClientToken = unknown;

const clientMap = new Map<ClientToken, unknown>();

export const mockWorkItemTrackingClient = {
  queryByWiql: jest.fn(async () => ({ workItems: [] })),
  getWorkItemsBatch: jest.fn(async () => []),
  updateWorkItem: jest.fn(async () => ({})),
};

export const mockCoreClient = {
  getProjects: jest.fn(async () => []),
};

export const mockGetClient = jest.fn((token: ClientToken) => {
  const client = clientMap.get(token);
  if (!client) {
    throw new Error("No mock client registered for requested token");
  }
  return client;
});

export function setMockClient(token: ClientToken, client: unknown): void {
  clientMap.set(token, client);
}

export function resetAzureDevopsApiMock(): void {
  clientMap.clear();
  clientMap.set(WorkItemTrackingRestClient, mockWorkItemTrackingClient);
  clientMap.set(CoreRestClient, mockCoreClient);

  mockGetClient.mockClear();

  mockWorkItemTrackingClient.queryByWiql.mockClear();
  mockWorkItemTrackingClient.queryByWiql.mockResolvedValue({ workItems: [] });

  mockWorkItemTrackingClient.getWorkItemsBatch.mockClear();
  mockWorkItemTrackingClient.getWorkItemsBatch.mockResolvedValue([]);

  mockWorkItemTrackingClient.updateWorkItem.mockClear();
  mockWorkItemTrackingClient.updateWorkItem.mockResolvedValue({});

  mockCoreClient.getProjects.mockClear();
  mockCoreClient.getProjects.mockResolvedValue([]);
}

resetAzureDevopsApiMock();

export const getClient = mockGetClient;
