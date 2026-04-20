describe("initializeIconSupport", () => {
  beforeEach(() => {
    document.body.classList.remove("fluent-icons-enabled");
    jest.resetModules();
  });

  it("adds fluent-icons-enabled class to document.body", async () => {
    const { initializeIconSupport } = await import("./initializeIconSupport");
    initializeIconSupport();
    expect(document.body.classList.contains("fluent-icons-enabled")).toBe(true);
  });

  it("is idempotent — calling twice does not throw", async () => {
    const { initializeIconSupport } = await import("./initializeIconSupport");
    expect(() => {
      initializeIconSupport();
      initializeIconSupport();
    }).not.toThrow();
    expect(document.body.classList.contains("fluent-icons-enabled")).toBe(true);
  });
});
