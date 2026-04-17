import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search tags…",
}) => (
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      padding: "6px 0 8px",
      borderBottom: "1px solid var(--palette-neutral-10, #e0e0e0)",
      marginBottom: "4px",
    }}
  >
    <input
      type="search"
      aria-label="Search tags"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        flex: 1,
        padding: "4px 28px 4px 8px",
        border: "1px solid var(--palette-neutral-20, #ccc)",
        borderRadius: "2px",
        fontSize: "13px",
        color: "var(--text-primary-color, #1e1e1e)",
        background: "var(--palette-neutral-0, #fff)",
        outline: "none",
      }}
    />
    {value && (
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => onChange("")}
        style={{
          position: "absolute",
          right: "4px",
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--palette-neutral-60, #555)",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    )}
  </div>
);
