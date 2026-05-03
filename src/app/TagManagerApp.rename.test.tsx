import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockTagService = {
  getAllTags: jest.fn(),
  getProjectName: jest.fn(),
  deleteTagById: jest.fn(),
  renameTagById: jest.fn(),
  mergeTag: jest.fn(),
};

jest.mock("../services/TagService", () => ({
  TagService: jest.fn(() => mockTagService),
}));

import { TagManagerApp } from "./TagManagerApp";

beforeEach(() => {
  localStorage.clear();
  Object.values(mockTagService).forEach((fn) => (fn as jest.Mock).mockReset());
  mockTagService.getProjectName.mockResolvedValue("Demo Project");
  mockTagService.getAllTags.mockResolvedValue([
    { id: "1", name: "alpha", url: "u" },
    { id: "2", name: "beta", url: "u" },
  ]);
  mockTagService.renameTagById.mockResolvedValue({ id: "1", name: "renamed-tag", url: "u" });
});

describe("TagManagerApp — rename flow", () => {
  it("calls renameTagById with the correct id and new name", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "renamed-tag");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      expect(mockTagService.renameTagById).toHaveBeenCalledWith("1", "renamed-tag");
    });
  });

  it("updates the tag name in the list after a successful rename", async () => {
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "renamed-tag");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      expect(screen.getByText("renamed-tag")).toBeInTheDocument();
      expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    });
  });

  it("keeps tags alphabetically ordered after a successful rename", async () => {
    mockTagService.renameTagById.mockResolvedValue({ id: "1", name: "zeta", url: "u" });
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "zeta");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      const beta = screen.getByText("beta");
      const zeta = screen.getByText("zeta");
      expect(beta.compareDocumentPosition(zeta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});

describe("TagManagerApp — rename failure", () => {
  it("leaves the original tag name in the list when rename fails", async () => {
    mockTagService.renameTagById.mockRejectedValue(new Error("permission denied"));
    const user = userEvent.setup();
    render(<TagManagerApp />);

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

    await user.dblClick(screen.getByText("alpha"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "new-name");
    await user.keyboard("[Enter]");

    await waitFor(() => {
      expect(mockTagService.renameTagById).toHaveBeenCalled();
      expect(screen.getByText("alpha")).toBeInTheDocument();
    });
  });
});
