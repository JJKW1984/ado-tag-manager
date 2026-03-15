// src/app/DeleteDialog.tsx
import React from "react";
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
      <ul style={{ margin: "12px 0 0 0", paddingLeft: "20px" }}>
        {tags.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong>
          </li>
        ))}
      </ul>
    </Dialog>
  );
};
