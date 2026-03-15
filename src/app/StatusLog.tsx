// src/app/StatusLog.tsx
import React, { useEffect, useRef, useState } from "react";
import { LogEntry } from "../types";

interface StatusLogProps {
  entries: LogEntry[];
}

const STATUS_ICONS: Record<LogEntry["status"], string> = {
  info: "ℹ",
  success: "✓",
  error: "✗",
  running: "…",
};

const STATUS_COLORS: Record<LogEntry["status"], string> = {
  info: "var(--palette-neutral-60, #555)",
  success: "var(--communication-foreground, #0078d4)",
  error: "var(--status-error-foreground, #c4314b)",
  running: "var(--palette-neutral-60, #555)",
};

export const StatusLog: React.FC<StatusLogProps> = ({ entries }) => {
  const [collapsed, setCollapsed] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && entries.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, collapsed]);

  if (entries.length === 0) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--palette-neutral-10, #eee)",
        marginTop: "16px",
        fontFamily: "monospace",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 0",
          cursor: "pointer",
          userSelect: "none",
          color: "var(--palette-neutral-60, #555)",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>{collapsed ? "▶" : "▼"}</span>
        <span>
          Activity Log ({entries.length} entr{entries.length !== 1 ? "ies" : "y"})
        </span>
      </div>

      {!collapsed && (
        <div
          style={{
            maxHeight: "200px",
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {entries.map((e) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                gap: "8px",
                padding: "2px 0",
                color: STATUS_COLORS[e.status],
              }}
            >
              <span style={{ minWidth: "60px", color: "var(--palette-neutral-30, #aaa)" }}>
                {e.timestamp.toLocaleTimeString()}
              </span>
              <span style={{ minWidth: "16px" }}>{STATUS_ICONS[e.status]}</span>
              <span>{e.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
