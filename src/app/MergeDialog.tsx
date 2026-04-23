// src/app/MergeDialog.tsx
import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { FormItem } from "azure-devops-ui/FormItem";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagItem } from "../types";

interface MergeDialogProps {
  sources: TagItem[];
  allTags: TagItem[];
  onConfirm: (targetName: string) => void;
  onCancel: () => void;
}

export const MergeDialog: React.FC<MergeDialogProps> = ({
  sources,
  allTags,
  onConfirm,
  onCancel,
}) => {
  const [targetName, setTargetName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = targetName.trim();

  // Suggestions: all tags that match the typed input
  const suggestions = allTags.filter(
    (t) =>
      trimmed.length > 0 &&
      t.name.toLowerCase().includes(trimmed.toLowerCase())
  );

  // True when the typed value doesn't match any existing tag name exactly
  const isNewTag =
    trimmed.length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  // Dropdown shows matching suggestions + a "Create new" entry when the name is new
  const totalItems = suggestions.length + (isNewTag ? 1 : 0);

  const isValid = trimmed.length > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetName(e.target.value);
    setHighlightedIndex(-1);
    setShowSuggestions(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || totalItems === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      if (highlightedIndex < suggestions.length) {
        selectSuggestion(suggestions[highlightedIndex].name);
      } else {
        // "Create new" row selected — keep the typed value, close the dropdown
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (name: string) => {
    setTargetName(name);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  return (
    <Dialog
      titleProps={{ text: "Merge Tags" }}
      footerButtonProps={[
        { text: "Cancel", onClick: onCancel },
        {
          text: "Merge",
          primary: true,
          danger: true,
          disabled: !isValid,
          onClick: () => onConfirm(trimmed),
          iconProps: { iconName: "BranchMerge"  },
        },
      ]}
      onDismiss={onCancel}
    >
      <MessageCard severity={MessageCardSeverity.Warning}>
        The following tag{sources.length !== 1 ? "s" : ""} will be merged into
        the target and removed from the project.
      </MessageCard>
      <div
        style={{
          border: "1px solid var(--palette-neutral-10, #e0e0e0)",
          borderRadius: "2px",
          margin: "12px 0 16px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "6px 12px",
            background: "var(--palette-neutral-4, #f8f8f8)",
            borderBottom: "1px solid var(--palette-neutral-10, #e0e0e0)",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--palette-neutral-60, #666)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Tag
        </div>
        {sources.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid var(--palette-neutral-10, #e0e0e0)",
              fontSize: "13px",
              color: "var(--text-primary-color, #1e1e1e)",
            }}
          >
            {t.name}
          </div>
        ))}
      </div>
      <FormItem label="Target tag">
        <div ref={containerRef} style={{ position: "relative" }}>
          <input
            type="text"
            value={targetName}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Type to search or create a tag"
            autoComplete="off"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "4px 8px",
              fontSize: "14px",
              lineHeight: "20px",
              border: "1px solid var(--palette-neutral-20, #c8c6c4)",
              borderRadius: "2px",
              background: "var(--callout-background-color, #fff)",
              color: "var(--text-primary-color, #1e1e1e)",
              outline: "none",
            }}
          />
          {showSuggestions && totalItems > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 1000,
                background: "var(--callout-background-color, #fff)",
                border: "1px solid var(--palette-neutral-20, #c8c6c4)",
                borderTop: "none",
                borderRadius: "0 0 2px 2px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.12)",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {suggestions.map((t, i) => (
                <div
                  key={t.id}
                  onMouseDown={() => selectSuggestion(t.name)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  style={{
                    padding: "6px 10px",
                    fontSize: "13px",
                    cursor: "pointer",
                    background:
                      i === highlightedIndex
                        ? "var(--palette-neutral-8, #e8e8e8)"
                        : "transparent",
                    color: "var(--text-primary-color, #1e1e1e)",
                  }}
                >
                  {t.name}
                </div>
              ))}
              {isNewTag && (
                <div
                  onMouseDown={() => setShowSuggestions(false)}
                  onMouseEnter={() => setHighlightedIndex(suggestions.length)}
                  style={{
                    padding: "6px 10px",
                    fontSize: "13px",
                    cursor: "pointer",
                    background:
                      highlightedIndex === suggestions.length
                        ? "var(--palette-neutral-8, #e8e8e8)"
                        : "transparent",
                    borderTop: suggestions.length > 0
                      ? "1px solid var(--palette-neutral-10, #e0e0e0)"
                      : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "var(--communication-foreground, #0078d4)", fontWeight: 600 }}>
                    {trimmed}
                  </span>
                  <span style={{
                    fontSize: "11px",
                    color: "var(--communication-foreground, #0078d4)",
                    background: "var(--palette-primary-tint-10, #deecf9)",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontWeight: 600,
                    letterSpacing: "0.2px",
                  }}>
                    Create new
                  </span>
                </div>
              )}
            </div>
          )}
          {/* Badge below the input when the field is not focused but contains a new tag name */}
          {!showSuggestions && isNewTag && (
            <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--communication-foreground, #0078d4)", fontWeight: 600 }}>
                {trimmed}
              </span>
              <span style={{
                fontSize: "11px",
                color: "var(--communication-foreground, #0078d4)",
                background: "var(--palette-primary-tint-10, #deecf9)",
                borderRadius: "10px",
                padding: "1px 7px",
                fontWeight: 600,
              }}>
                New tag
              </span>
            </div>
          )}
        </div>
      </FormItem>
    </Dialog>
  );
};
