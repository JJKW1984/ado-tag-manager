import { validateTagName } from "./validateTagName";

describe("validateTagName", () => {
  it("accepts a normal tag name", () => {
    expect(validateTagName("bug")).toEqual({ valid: true });
  });

  it("rejects an empty string", () => {
    const result = validateTagName("   ");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("rejects a name longer than 256 characters", () => {
    const result = validateTagName("a".repeat(257));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/256/);
  });

  it("rejects a name that contains a semicolon", () => {
    const result = validateTagName("bug;feature");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/semicolon/i);
  });

  it("accepts a name that is exactly 256 characters", () => {
    expect(validateTagName("a".repeat(256))).toEqual({ valid: true });
  });

  it("accepts a name with spaces and hyphens", () => {
    expect(validateTagName("payment-gateway v2")).toEqual({ valid: true });
  });
});
