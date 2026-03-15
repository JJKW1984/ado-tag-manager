// src/app/ActionBar.tsx
import React from "react";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";

interface ActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onMerge: () => void;
  onCount: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  selectedCount,
  onDelete,
  onMerge,
  onCount,
}) => {
  const disabled = selectedCount === 0;
  const label = selectedCount > 0 ? ` (${selectedCount})` : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 0",
      }}
    >
      <ButtonGroup>
        <Button
          text={`Delete${label}`}
          danger
          disabled={disabled}
          onClick={onDelete}
        />
        <Button
          text={`Merge${label}`}
          disabled={disabled}
          onClick={onMerge}
        />
        <Button
          text={`Count${label}`}
          subtle
          disabled={disabled}
          onClick={onCount}
        />
      </ButtonGroup>
      {selectedCount > 0 && (
        <span style={{ color: "var(--palette-neutral-30, #888)", fontSize: "12px" }}>
          {selectedCount} tag{selectedCount !== 1 ? "s" : ""} selected
        </span>
      )}
    </div>
  );
};
