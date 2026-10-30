import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const dispatchFile = JSON.parse(readFileSync("public/fixtures/vendor-dispatch-VDU-8841.json", "utf8"));
const statusFile = JSON.parse(readFileSync("public/fixtures/vendor-status-VDU-8842.json", "utf8"));

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

describe("prototype", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("vendor-dispatch-VDU-8841")) return jsonResponse(dispatchFile);
        if (String(url).includes("vendor-status-VDU-8842")) return jsonResponse(statusFile);
        return jsonResponse({}, false);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the short shipment and the separate source counts", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Short by 260/ })).toBeTruthy();
    expect(screen.getByTestId("shippable").textContent).toBe("740");
    expect(screen.getByTestId("vendor-qty").textContent).toBe("800");
    expect(screen.getByTestId("customer-short").textContent).toBe("260");
    expect(screen.getByTestId("claim-qty").textContent).toBe("0");
    expect(screen.getByText("1,000 sent − 800 reported")).toBeTruthy();
    expect(screen.getByText("800 reported − 780 counted")).toBeTruthy();
  });

  it("fails a simulated import, retries, and does not double-count", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Vendor import" }));
    await user.click(screen.getByRole("checkbox", { name: /Simulate a timeout/ }));
    await user.click(screen.getByRole("button", { name: "Import dispatch VDU-8841" }));

    expect((await screen.findByTestId("import-result")).textContent).toMatch(/Simulated timeout/);
    expect(screen.getByTestId("vendor-qty").textContent).toBe("800");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Retry import" }));
    expect((await screen.findByTestId("import-result")).textContent).toMatch(/Already imported \(VDU-8841\)/);
    expect(screen.getByTestId("import-vendor-qty").textContent).toBe("800");

    await user.click(screen.getByRole("button", { name: "Import status VDU-8842" }));
    expect((await screen.findByTestId("import-result")).textContent).toMatch(/Imported VDU-8842 once/);
    expect(screen.getByText(/still in the furnace/)).toBeTruthy();
    expect(screen.getByTestId("applied-ids").textContent).toBe("VDU-8841 VDU-8842");
    expect(screen.getByTestId("vendor-qty").textContent).toBe("800");

    await user.click(screen.getByRole("button", { name: "Import status VDU-8842" }));
    expect((await screen.findByTestId("import-result")).textContent).toMatch(/Already imported \(VDU-8842\)/);
    expect(screen.getAllByText(/still in the furnace/)).toHaveLength(1);
    expect(screen.getByTestId("applied-ids").textContent).toBe("VDU-8841 VDU-8842");
    expect(screen.getByTestId("vendor-qty").textContent).toBe("800");
  });

  it("records decisions and refreshes status without changing the disagreement", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Decisions 6" }));
    await user.click(screen.getByRole("button", { name: "Post inspection QI-318" }));
    await user.click(screen.getByRole("button", { name: "Send the 40 rejects back for rework" }));
    await user.click(screen.getByRole("button", { name: "Raise shortage claim for 20" }));
    await user.click(screen.getByRole("button", { name: "Hold the invoice" }));
    await user.click(screen.getByRole("button", { name: "Chase the 200 still out" }));
    await user.click(screen.getByRole("button", { name: "Warn Bharat Axle" }));

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByTestId("claim-qty").textContent).toBe("20");
    expect(screen.getByTestId("held-qty").textContent).toBe("60");
    expect(screen.getByTestId("reject-assigned").textContent).toBe("40");
    expect(screen.getByTestId("told-qty").textContent).toBe("740");
    expect(screen.getByTestId("vendor-qty").textContent).toBe("800");
    expect(screen.getByTestId("customer-short").textContent).toBe("260");
    expect(screen.getByTestId("next-actions").textContent).toMatch(/Follow-up is filed/);
    expect(screen.getByTestId("next-actions").textContent).toMatch(/short by 260/);

    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("Shortage claim raised for 20")).toBeTruthy();
    expect(screen.getByText("Inspection QI-318 posted")).toBeTruthy();
  });
});
