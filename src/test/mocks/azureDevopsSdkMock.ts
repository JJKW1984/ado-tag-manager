type ProjectInfo = { name: string } | null;

type WorkItemContributionHandler = Record<string, (...args: unknown[]) => unknown>;

let projectInfo: ProjectInfo = { name: "Demo Project" };
const registeredHandlers: WorkItemContributionHandler[] = [];

export const mockInit = jest.fn().mockResolvedValue(undefined);
export const mockNotifyLoadSucceeded = jest.fn();
export const mockGetAccessToken = jest.fn().mockResolvedValue("test-access-token");
export const mockGetHost = jest.fn(() => ({ name: "demo-org" }));

export const mockProjectPageService = {
  getProject: jest.fn(async () => projectInfo),
};

export const mockGetService = jest.fn(async () => mockProjectPageService);

export const mockRegister = jest.fn(
  (_contributionId: string, handler: WorkItemContributionHandler) => {
    if (handler) {
      registeredHandlers.push(handler);
    }
  }
);

export function setMockProject(name: string | null): void {
  projectInfo = name ? { name } : null;
}

export function triggerRegisteredEvent(eventName: string, ...args: unknown[]): void {
  const handler = registeredHandlers[registeredHandlers.length - 1];
  if (!handler || typeof handler[eventName] !== "function") {
    throw new Error(`No registered handler for event: ${eventName}`);
  }
  handler[eventName](...args);
}

export function resetAzureDevopsSdkMock(): void {
  projectInfo = { name: "Demo Project" };
  registeredHandlers.length = 0;

  mockInit.mockClear();
  mockInit.mockResolvedValue(undefined);

  mockNotifyLoadSucceeded.mockClear();

  mockGetAccessToken.mockClear();
  mockGetAccessToken.mockResolvedValue("test-access-token");

  mockGetHost.mockClear();
  mockGetHost.mockReturnValue({ name: "demo-org" });

  mockProjectPageService.getProject.mockClear();
  mockProjectPageService.getProject.mockImplementation(async () => projectInfo);

  mockGetService.mockClear();
  mockGetService.mockImplementation(async () => mockProjectPageService);

  mockRegister.mockClear();
}

export function getRegisteredHandlerCount(): number {
  return registeredHandlers.length;
}

export const init = mockInit;
export const notifyLoadSucceeded = mockNotifyLoadSucceeded;
export const getAccessToken = mockGetAccessToken;
export const getHost = mockGetHost;
export const getService = mockGetService;
export const register = mockRegister;
