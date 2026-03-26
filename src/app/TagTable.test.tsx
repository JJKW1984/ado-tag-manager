import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { TagTable } from "./TagTable";

describe("TagTable", () => {
  it("shows zero data state when no tags are available", () => {
    render(
      <TagTable
        tags={[]}
        selectedIds={new Set()}
        onToggle={jest.fn()}
        onToggleAll={jest.fn()}
      />
    );

    expect(screen.getByText("No tags found")).toBeInTheDocument();
  });

  it("toggles row selection and select-all", () => {
    const onToggle = jest.fn();
    const onToggleAll = jest.fn();

    render(
      <TagTable
        tags={[
          { id: "1", name: "alpha", url: "u1" },
          { id: "2", name: "beta", url: "u2", count: 5 },
        ]}
        selectedIds={new Set(["2"])}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(onToggleAll).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith("1");
  });
});
