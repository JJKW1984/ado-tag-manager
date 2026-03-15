// src/app/CountConfirmDialog.tsx
import React from "react";
import { Dialog } from "azure-devops-ui/Dialog";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { TagItem } from "../types";

interface CountConfirmDialogProps {
  tags: TagItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const CountConfirmDialog: React.FC<CountConfirmDialogProps> = ({
  tags,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      titleProps={{ text: "Count Work Items" }}
      footerButtonProps={[
        { text: "Cancel", onClick: onCancel },
        {
          text: `Count ${tags.length} tags`,
          primary: true,
          onClick: onConfirm,
        },
      ]}
      onDismiss={onCancel}
    >
      <MessageCard severity={MessageCardSeverity.Info}>
        You've selected <strong>{tags.length} tags</strong>. Counting work items
        across all projects may take a while depending on the size of your
        organisation. Do you want to continue?
      </MessageCard>
    </Dialog>
  );
};
