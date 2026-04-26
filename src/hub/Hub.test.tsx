import "@testing-library/jest-dom";

const renderMock = jest.fn();

jest.mock("react-dom", () => ({
  render: (...args: unknown[]) => renderMock(...args),
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Hub bootstrap", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockReset();
    jest.resetModules();
  });

  it("initializes SDK, renders app, and notifies load success", async () => {
    const sdkMock = await import("../test/mocks/azureDevopsSdkMock");

    await import("./Hub");
    await flushPromises();

    expect(sdkMock.mockInit).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(sdkMock.mockNotifyLoadSucceeded).toHaveBeenCalledTimes(1);
  });

});
