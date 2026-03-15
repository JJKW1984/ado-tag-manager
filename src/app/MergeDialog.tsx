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
      <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
        {sources.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong>
          </li>
        ))}
      </ul>
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
