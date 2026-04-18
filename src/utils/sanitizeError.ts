export function sanitizeError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw);
  const firstLine = msg.split("\n")[0];
  const withoutUrls = firstLine.replace(/\bhttps?:\/\/[^\s,;)>"'\]]+/gi, "[redacted-url]");
  const withoutBearer = withoutUrls.replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]");
  const withoutTokens = withoutBearer.replace(
    /\b(token|pat|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[redacted]"
  );
  return withoutTokens.slice(0, 200);
}
