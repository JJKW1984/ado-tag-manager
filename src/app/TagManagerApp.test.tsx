import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockTagService = {
  getAllTags: jest.fn(),
  getProjectName: jest.fn(),
  deleteTagById: jest.fn(),
  renameTagById: jest.fn(),
  mergeTag: jest.fn(),
  countTagAcrossProjects: jest.fn(),
};

jest.mock("../services/TagService", () => ({
  TagService: jest.fn(() => mockTagService),
}));

import { TagManagerApp } from "./TagManagerApp";

describe("TagManagerApp", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(mockTagService).forEach((fn) => fn.mockReset());

    mockTagService.getProjectName.mockResolvedValue("Demo Project");
    mockTagService.deleteTagById.mockResolvedValue(undefined);
    mockTagService.mergeTag.mockResolvedValue({
      affectedCount: 1,
      workItemIds: [1],
    });
    mockTagService.countTagAcrossProjects.mockResolvedValue(2);
  });

  it("loads tags and renders management actions", async () => {
    mockTagService.getAllTags.mockResolvedValue([
      { id: "1", name: "alpha", url: "u" },
      { id: "2", name: "beta", url: "u" },
    ]);

    render(<TagManagerApp />);

    expect(screen.getByText(/Loading tags/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("alpha")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Count" })).toBeDisabled();
  });

  it("shows an error card when loading fails", async () => {
    mockTagService.getAllTags.mockRejectedValue(new Error("boom"));

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
  });

  it("opens count confirmation dialog when many tags are selected", async () => {
    mockTagService.getAllTags.mockResolvedValue(
      Array.from({ length: 11 }, (_v, i) => ({
        id: `${i + 1}`,
        name: `tag-${i + 1}`,
        url: "u",
      }))
    );

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText("tag-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Count (11)" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Count Work Items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count 11 tags" })).toBeInTheDocument();
  });

  it("renders ADO pagination buttons when there are more than 25 tags", async () => {
    mockTagService.getAllTags.mockResolvedValue(
      Array.from({ length: 30 }, (_v, i) => ({
        id: `${i + 1}`,
        name: `tag-${String.fromCharCode(65 + (i % 26))}-${i + 1}`,
        url: "u",
      }))
    );

    render(<TagManagerApp />);

    await waitFor(() => {
      expect(screen.getByText(/tag-A-1/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });
});
