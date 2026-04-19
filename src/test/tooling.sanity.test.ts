describe("test tooling", () => {
  it("runs the test harness", () => {
    expect(true).toBe(true);
  });

  it("webpack config emits icon font assets", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const webpackConfig = require("../../webpack.config.js");
    const rules = Array.isArray(webpackConfig?.module?.rules) ? webpackConfig.module.rules : [];
    const fontRule = rules.find((rule: { test?: RegExp; type?: string }) =>
      rule?.test instanceof RegExp &&
      rule.test.test("file.woff2") &&
      rule.test.test("file.ttf") &&
      rule.test.test("file.svg")
    );

    expect(fontRule).toBeDefined();
    expect(fontRule.type).toBe("asset/resource");
  });
});
