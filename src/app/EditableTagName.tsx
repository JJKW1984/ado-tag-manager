import React, { useRef, useState } from "react";
import { validateTagName } from "../utils/validateTagName";

export interface EditableTagNameProps {
  name: string;
  onRename: (newName: string) => void | Promise<void>;
  onCancel: () => void;
  existingNames: string[];
}

export const EditableTagName: React.FC<EditableTagNameProps> = ({
  name,
  onRename,
  onCancel,
  existingNames,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  // Prevents blur from triggering a second commit after Enter already committed.
  const committedRef = useRef(false);

  const commit = async () => {
    if (committedRef.current) return;
    const validation = validateTagName(draft);
    if (!validation.valid) {
      setError(validation.reason ?? "Invalid tag name.");
      return;
    }
    const isDuplicate =
      draft.trim().toLowerCase() !== name.toLowerCase() &&
      existingNames.some((n) => n.toLowerCase() === draft.trim().toLowerCase());
    if (isDuplicate) {
      setError("A tag with this name already exists — use Merge instead.");
      return;
    }
    committedRef.current = true;
    setEditing(false);
    setError(null);
    try {
      await onRename(draft.trim());
    } catch {
      onCancel();
    }
    Promise.resolve().then(() => {
      committedRef.current = false;
    });
  };

  const cancel = () => {
    committedRef.current = true;
    setEditing(false);
    setDraft(name);
    setError(null);
    onCancel();
    Promise.resolve().then(() => {
      committedRef.current = false;
    });
  };

  if (editing) {
    return (
      <div>
        <input
          aria-label="Edit tag name"
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "2px 6px",
            fontSize: "13px",
            border: "1px solid var(--palette-neutral-20, #c8c6c4)",
            borderRadius: "2px",
            background: "var(--callout-background-color, #fff)",
            color: "var(--text-primary-color, #1e1e1e)",
            outline: "none",
          }}
        />
        {error && (
          <div
            role="alert"
            style={{
              fontSize: "12px",
              color: "var(--status-error-foreground, #c4314b)",
              marginTop: "2px",
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      onDoubleClick={() => {
        setDraft(name);
        setError(null);
        setEditing(true);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "default" }}
    >
      {name}
      {hovered && (
        <span
          aria-hidden="true"
          title="Rename"
          style={{ fontSize: "11px", color: "var(--palette-neutral-30, #aaa)" }}
        >
          ✎
        </span>
      )}
    </span>
  );
};
