import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { MergeDialog } from "./MergeDialog";

describe("MergeDialog", () => {
  const sources = [{ id: "1", name: "old-tag", url: "u" }];
  const allTags = [
    { id: "2", name: "platform", url: "u" },
    { id: "3", name: "frontend", url: "u" },
  ];

  it("supports selecting an existing suggestion", () => {
    const onConfirm = jest.fn();

    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Type to search or create a tag"), {
      target: { value: "plat" },
    });

    fireEvent.mouseDown(screen.getByText("platform"));
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));

    expect(onConfirm).toHaveBeenCalledWith("platform");
  });

  it("shows create-new affordance for unknown target tag", () => {
    render(
      <MergeDialog
        sources={sources}
        allTags={allTags}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Type to search or create a tag"), {
      target: { value: "newly-created" },
    });

    expect(screen.getByText("Create new")).toBeInTheDocument();
  });
});
