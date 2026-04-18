import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableTagName } from "./EditableTagName";

const defaultProps = {
  name: "old-tag",
  onRename: jest.fn(),
  onCancel: jest.fn(),
  existingNames: ["platform", "frontend"],
};

beforeEach(() => {
  defaultProps.onRename.mockReset();
  defaultProps.onCancel.mockReset();
});

describe("EditableTagName — display mode", () => {
  it("renders the tag name as text", () => {
    render(<EditableTagName {...defaultProps} />);
    expect(screen.getByText("old-tag")).toBeInTheDocument();
  });

  it("does not show an input initially", () => {
    render(<EditableTagName {...defaultProps} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows a pencil icon when hovered", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.hover(screen.getByText("old-tag"));
    expect(screen.getByTitle("Rename")).toBeInTheDocument();
  });

  it("hides the pencil icon when not hovered", () => {
    render(<EditableTagName {...defaultProps} />);
    expect(screen.queryByTitle("Rename")).not.toBeInTheDocument();
  });

  it("shows a visible focus outline when focused", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.tab();
    expect(screen.getByRole("button", { name: /Rename tag old-tag/i })).toHaveStyle(
      "outline: 2px solid var(--communication-foreground, #0078d4)"
    );
  });
});

describe("EditableTagName — entering edit mode", () => {
  it("shows a text input after double-click", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toBeInTheDocument();
  });

  it("pre-fills the input with the current name", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toHaveValue("old-tag");
  });

  it("enters edit mode with keyboard Enter when focused", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.tab();
    await user.keyboard("[Enter]");
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toBeInTheDocument();
  });

  it("enters edit mode with keyboard F2 when focused", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.tab();
    await user.keyboard("{F2}");
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toBeInTheDocument();
  });

  it("enters edit mode with keyboard Space when focused", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("textbox", { name: "Edit tag name" })).toBeInTheDocument();
  });
});

describe("EditableTagName — committing a rename", () => {
  it("calls onRename with the trimmed new value when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "new-name");
    await user.keyboard("[Enter]");
    expect(defaultProps.onRename).toHaveBeenCalledWith("new-name");
  });

  it("exits edit mode after Enter", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    await user.keyboard("[Enter]");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("calls onRename when the input is blurred", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "blurred-name");
    await user.tab();
    expect(defaultProps.onRename).toHaveBeenCalledWith("blurred-name");
  });
});

describe("EditableTagName — cancelling a rename", () => {
  it("calls onCancel and exits edit mode when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    await user.keyboard("[Escape]");
    expect(defaultProps.onCancel).toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the original name again after Escape", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "something-else");
    await user.keyboard("[Escape]");
    expect(screen.getByText("old-tag")).toBeInTheDocument();
  });

  it("calls onCancel when onRename rejects (API failure)", async () => {
    const onRename = jest.fn().mockRejectedValue(new Error("api error"));
    const onCancel = jest.fn();
    const user = userEvent.setup();
    render(
      <EditableTagName
        name="old-tag"
        onRename={onRename}
        onCancel={onCancel}
        existingNames={[]}
      />
    );
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "new-name");
    await user.keyboard("[Enter]");
    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });
});

describe("EditableTagName — validation", () => {
  it("shows an error and stays in edit mode when Enter is pressed with empty input", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it("shows a merge hint when the typed name matches an existing tag", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "platform");
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toHaveTextContent(/Merge/i);
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it("treats duplicate check as case-insensitive", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.type(input, "PLATFORM");
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toHaveTextContent(/Merge/i);
  });

  it("allows renaming to the same name (no-op rename, not a duplicate)", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    await user.keyboard("[Enter]");
    expect(defaultProps.onRename).toHaveBeenCalledWith("old-tag");
  });

  it("clears the error message when the user starts typing again", async () => {
    const user = userEvent.setup();
    render(<EditableTagName {...defaultProps} />);
    await user.dblClick(screen.getByText("old-tag"));
    const input = screen.getByRole("textbox", { name: "Edit tag name" });
    await user.clear(input);
    await user.keyboard("[Enter]");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.type(input, "f");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
