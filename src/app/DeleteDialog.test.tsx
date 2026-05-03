import React from "react";
import { render, screen } from "@testing-library/react";
import { DeleteDialog } from "./DeleteDialog";

describe("DeleteDialog", () => {
  it("shows a count label and renders tags as pills", () => {
    render(
      <DeleteDialog
        tags={[
          { id: "1", name: "alpha", url: "u" },
          { id: "2", name: "beta", url: "u" },
        ]}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("2 tags will be deleted")).toBeInTheDocument();
    expect(screen.queryByText("Tag")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("pill")).toHaveLength(2);
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("uses the singular label for one tag", () => {
    render(
      <DeleteDialog
        tags={[{ id: "1", name: "solo", url: "u" }]}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("1 tag will be deleted")).toBeInTheDocument();
  });
});