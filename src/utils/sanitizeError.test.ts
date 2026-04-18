import { sanitizeError } from "./sanitizeError";

describe("sanitizeError", () => {
  it("returns the message from an Error", () => {
    expect(sanitizeError(new Error("something went wrong"))).toBe(
      "something went wrong"
    );
  });

  it("stringifies non-Error values", () => {
    expect(sanitizeError("raw string")).toBe("raw string");
    expect(sanitizeError(42)).toBe("42");
  });

  it("truncates messages longer than 200 characters", () => {
    const result = sanitizeError(new Error("x".repeat(300)));
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("strips content after the first newline", () => {
    const result = sanitizeError(new Error("first line\nat: somewhere"));
    expect(result).toBe("first line");
  });

  it("redacts URLs", () => {
    const result = sanitizeError(new Error("request failed at https://contoso.example/api?token=abc123"));
    expect(result).toBe("request failed at [redacted-url]");
  });

  it("redacts bearer tokens", () => {
    const result = sanitizeError(new Error("Unauthorized: Bearer abc123.xyz"));
    expect(result).toBe("Unauthorized: Bearer [redacted]");
  });

  it("redacts token-like key/value pairs", () => {
    const result = sanitizeError(new Error("permission denied token=abc123 authorization:secret"));
    expect(result).toBe("permission denied token=[redacted] authorization=[redacted]");
  });
});
