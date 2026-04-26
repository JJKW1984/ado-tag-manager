// src/app/DeleteDialog.tsx
import React from "react";
import { Icon } from "azure-devops-ui/Icon";
import { Dialog } from "azure-devops-ui/Dialog";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagItem } from "../types";

interface DeleteDialogProps {
  tags: TagItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  tags,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      titleProps={{ text: "Delete Tags" }}
      footerButtonProps={[
        { text: "Cancel", onClick: onCancel },
        {
          text: `Delete ${tags.length} tag${tags.length !== 1 ? "s" : ""}`,
          primary: true,
          danger: true,
          onClick: onConfirm,
          iconProps: { iconName: "Delete" },
        },
      ]}
      onDismiss={onCancel}
    >
      <MessageCard severity={MessageCardSeverity.Warning}>
        This will permanently delete the following tag
        {tags.length !== 1 ? "s" : ""} and remove{" "}
        {tags.length !== 1 ? "them" : "it"} from all work items and pull
        requests. This cannot be undone.
      </MessageCard>
      <div
        style={{
          border: "1px solid var(--palette-neutral-10, #e0e0e0)",
          borderRadius: "2px",
          margin: "12px 0 4px",
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
        {tags.map((t) => (
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
    </Dialog>
  );
};
