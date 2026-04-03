import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { StatusLog } from "./StatusLog";

describe("StatusLog", () => {
  it("does not render when empty", () => {
    const { container } = render(<StatusLog entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("expands and renders log entries", () => {
    render(
      <StatusLog
        entries={[
          {
            id: 1,
            timestamp: new Date("2026-01-01T00:00:00.000Z"),
            message: "Did work",
            status: "success",
          },
        ]}
      />
    );

    expect(screen.queryByText("Did work")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Activity Log (1 entry)"));

    expect(screen.getByText("Did work")).toBeInTheDocument();
  });
});
