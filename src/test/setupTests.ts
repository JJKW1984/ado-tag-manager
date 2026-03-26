import "@testing-library/jest-dom";
import { resetAzureDevopsApiMock } from "./mocks/azureDevopsApiMock";
import { resetAzureDevopsSdkMock } from "./mocks/azureDevopsSdkMock";

jest.mock("azure-devops-extension-sdk", () =>
	require("./mocks/azureDevopsSdkMock")
);

jest.mock("azure-devops-extension-api", () =>
	require("./mocks/azureDevopsApiMock")
);

beforeEach(() => {
	resetAzureDevopsSdkMock();
	resetAzureDevopsApiMock();
	jest.restoreAllMocks();
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
	writable: true,
	value: jest.fn(),
});
