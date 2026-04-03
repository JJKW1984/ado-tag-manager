import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { CoreRestClient } from "azure-devops-extension-api/Core/CoreClient";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";

import {
  getRegisteredHandlerCount,
  mockRegister,
  triggerRegisteredEvent,
} from "../mocks/azureDevopsSdkMock";

import {
  mockCoreClient,
  mockWorkItemTrackingClient,
} from "../mocks/azureDevopsApiMock";

describe("azure devops mock infrastructure", () => {
  it("returns default API clients through getClient", async () => {
    const core = getClient(CoreRestClient);
    const wit = getClient(WorkItemTrackingRestClient);

    expect(core).toBe(mockCoreClient);
    expect(wit).toBe(mockWorkItemTrackingClient);
  });

  it("captures and triggers registered SDK event handlers", () => {
    const handler = {
      onSaved: jest.fn(),
    };

    SDK.register("test-contribution", handler as never);

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(getRegisteredHandlerCount()).toBe(1);

    triggerRegisteredEvent("onSaved", { id: 123 });

    expect(handler.onSaved).toHaveBeenCalledWith({ id: 123 });
  });
});
