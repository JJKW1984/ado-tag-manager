export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateTagName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "Tag name cannot be empty." };
  }
  if (trimmed.length > 256) {
    return { valid: false, reason: "Tag name cannot exceed 256 characters." };
  }
  if (trimmed.includes(";")) {
    return {
      valid: false,
      reason: 'Tag names cannot contain semicolons — ADO uses ";" to separate tags.',
    };
  }
  return { valid: true };
}
