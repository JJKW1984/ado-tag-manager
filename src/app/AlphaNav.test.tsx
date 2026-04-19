import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlphaNav } from "./AlphaNav";

const tags = [
  { id: "1", name: "alpha", url: "" },
  { id: "2", name: "beta", url: "" },
  { id: "3", name: "gamma", url: "" },
  { id: "4", name: "42-sprint", url: "" },
];

describe("AlphaNav", () => {
  it("renders the All tab and only tabs for letters that have tags", () => {
    render(<AlphaNav tags={tags} activeFilter={null} onFilter={() => {}} />);

    expect(screen.getByTestId("ado-tab-all")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-A")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-B")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-G")).toBeInTheDocument();
    expect(screen.getByTestId("ado-tab-#")).toBeInTheDocument();
    expect(screen.queryByTestId("ado-tab-C")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ado-tab-Z")).not.toBeInTheDocument();
  });

  it("calls onFilter(null) when the All tab is clicked", async () => {
    const onFilter = jest.fn();
    render(<AlphaNav tags={tags} activeFilter="A" onFilter={onFilter} />);

    await userEvent.click(screen.getByTestId("ado-tab-all"));

    expect(onFilter).toHaveBeenCalledWith(null);
  });

  it("calls onFilter with the letter when a letter tab is clicked", async () => {
    const onFilter = jest.fn();
    render(<AlphaNav tags={tags} activeFilter={null} onFilter={onFilter} />);

    await userEvent.click(screen.getByTestId("ado-tab-A"));

    expect(onFilter).toHaveBeenCalledWith("A");
  });

  it("calls onFilter('#') when the hash tab is clicked", async () => {
    const onFilter = jest.fn();
    render(<AlphaNav tags={tags} activeFilter={null} onFilter={onFilter} />);

    await userEvent.click(screen.getByTestId("ado-tab-#"));

    expect(onFilter).toHaveBeenCalledWith("#");
  });

  it("renders a tab for # when tags start with non-alpha characters", () => {
    const numericTags = [{ id: "1", name: "123-sprint", url: "" }];
    render(<AlphaNav tags={numericTags} activeFilter={null} onFilter={() => {}} />);

    expect(screen.getByTestId("ado-tab-#")).toBeInTheDocument();
    expect(screen.queryByTestId("ado-tab-A")).not.toBeInTheDocument();
  });
});
