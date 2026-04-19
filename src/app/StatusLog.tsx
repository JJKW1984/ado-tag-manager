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
    <div className="tm-status-log">
      <div
        className="tm-status-log__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>{collapsed ? "▶" : "▼"}</span>
        <span>
          Activity Log ({entries.length} entr{entries.length !== 1 ? "ies" : "y"})
        </span>
      </div>

      {!collapsed && (
        <div className="tm-status-log__body">
          {entries.map((e) => (
            <div
              key={e.id}
              className="tm-status-log__entry"
              style={{ color: STATUS_COLORS[e.status] }}
            >
              <span className="tm-status-log__timestamp">
                {e.timestamp.toLocaleTimeString()}
              </span>
              <span className="tm-status-log__icon">{STATUS_ICONS[e.status]}</span>
              <span>{e.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
