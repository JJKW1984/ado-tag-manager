export function sanitizeError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw);
  const firstLine = msg.split("\n")[0];
  return firstLine.slice(0, 200);
}
