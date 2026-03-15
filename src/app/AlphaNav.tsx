// src/app/AlphaNav.tsx
import React from "react";
import { TagItem } from "../types";

interface AlphaNavProps {
  tags: TagItem[];
  activeFilter: string | null;
  onFilter: (letter: string | null) => void;
}

const LETTERS = ["#", ...Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
)];

export const AlphaNav: React.FC<AlphaNavProps> = ({
  tags,
  activeFilter,
  onFilter,
}) => {
  const available = new Set(
    tags.map((t) => {
      const ch = t.name[0]?.toUpperCase();
      return ch && ch >= "A" && ch <= "Z" ? ch : "#";
    })
  );

  const btnBase: React.CSSProperties = {
    display: "inline-block",
    minWidth: "24px",
    padding: "2px 4px",
    marginRight: "2px",
    border: "none",
    borderRadius: "2px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    textAlign: "center",
    background: "transparent",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0",
        padding: "6px 0 8px",
        borderBottom: "1px solid var(--palette-neutral-10, #e0e0e0)",
        marginBottom: "4px",
      }}
    >
      {/* All button */}
      <button
        style={{
          ...btnBase,
          marginRight: "8px",
          color: activeFilter === null
            ? "var(--communication-foreground, #0078d4)"
            : "var(--palette-neutral-60, #555)",
          fontWeight: activeFilter === null ? 700 : 500,
          textDecoration: activeFilter === null ? "underline" : "none",
        }}
        onClick={() => onFilter(null)}
      >
        All
      </button>

      {LETTERS.map((letter) => {
        const isActive = activeFilter === letter;
        const hasItems = available.has(letter);
        return (
          <button
            key={letter}
            disabled={!hasItems}
            style={{
              ...btnBase,
              color: isActive
                ? "var(--communication-foreground, #0078d4)"
                : hasItems
                ? "var(--text-primary-color, #1e1e1e)"
                : "var(--palette-neutral-20, #ccc)",
              fontWeight: isActive ? 700 : 400,
              textDecoration: isActive ? "underline" : "none",
              cursor: hasItems ? "pointer" : "default",
              background: isActive
                ? "var(--palette-neutral-6, #f0f0f0)"
                : "transparent",
            }}
            onClick={() => hasItems && onFilter(letter)}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
};
