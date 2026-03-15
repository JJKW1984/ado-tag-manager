// src/app/MergeDialog.tsx
import React, { useState } from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { TextField, TextFieldWidth } from "azure-devops-ui/TextField";
import { FormItem } from "azure-devops-ui/FormItem";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagItem } from "../types";

interface MergeDialogProps {
  sources: TagItem[];
  onConfirm: (targetName: string) => void;
  onCancel: () => void;
}

export const MergeDialog: React.FC<MergeDialogProps> = ({
  sources,
  onConfirm,
  onCancel,
}) => {
  const [targetName, setTargetName] = useState("");
  const isValid = targetName.trim().length > 0;

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
          onClick: () => onConfirm(targetName.trim()),
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
      <FormItem label="Target tag (type to create or match existing)">
        <TextField
          value={targetName}
          onChange={(_e, val) => setTargetName(val)}
          placeholder="Enter target tag name"
          width={TextFieldWidth.standard}
        />
      </FormItem>
    </Dialog>
  );
};
