import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FACTS,
  createState,
  decisionFigures,
  nextActions,
  parseVendorMessage,
  picture,
  reducer,
  type AppState,
  type VendorMessage,
} from "./domain";

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(`public/fixtures/${name}`, "utf8"));
}

function parsed(name: string): VendorMessage {
  const result = parseVendorMessage(readFixture(name));
  if (!result.ok) throw new Error(result.error);
  return result.message;
}

describe("opening figures", () => {
  it("keeps the assignment quantities in disagreement", () => {
    expect(FACTS.acceptedQty + FACTS.rejectedQty).toBe(FACTS.receivedQty);
    const gaps = picture(createState());
    expect(gaps.vendor).toBe(800);
    expect(gaps.stillOut).toBe(200);
    expect(gaps.transitGap).toBe(20);
    expect(gaps.shippable).toBe(740);
    expect(gaps.customerShort).toBe(260);
    expect(gaps.invoiceAboveAccepted).toBe(60);
    expect(gaps.invoiceAboveReceived).toBe(20);
    expect(FACTS.otherFinishedStock).toBe(0);
    expect(decisionFigures(createState())).toMatchObject({
      claimQty: 0,
      heldQty: 0,
      reworkQty: 0,
      toldCustomerQty: 0,
    });
  });
});

describe("vendor import", () => {
  const at = "2026-10-30T12:00:00.000Z";

  it("sets a dispatch total once and does not add it again", () => {
    const dispatch = parsed("vendor-dispatch-VDU-8841.json");
    expect(dispatch.kind === "dispatch" && dispatch.dispatchedQty).toBe(800);

    let state: AppState = { ...createState(), vendorReportedQty: 0, appliedMessageIds: [] };
    state = reducer(state, { type: "IMPORT_MESSAGE", message: dispatch, at });
    expect(state.vendorReportedQty).toBe(800);
    expect(state.appliedMessageIds).toEqual(["VDU-8841"]);

    state = reducer(state, { type: "IMPORT_MESSAGE", message: dispatch, at });
    expect(state.vendorReportedQty).toBe(800);
    expect(state.appliedMessageIds).toEqual(["VDU-8841"]);
    expect(state.lastImport).toEqual({ type: "duplicate", messageId: "VDU-8841" });

    if (dispatch.kind !== "dispatch") throw new Error("expected dispatch");
    const correction = { ...dispatch, messageId: "VDU-9000", dispatchedQty: 50 };
    state = reducer(state, { type: "IMPORT_MESSAGE", message: correction, at });
    expect(state.vendorReportedQty).toBe(50);
  });

  it("imports a status note once and leaves every quantity alone", () => {
    const status = parsed("vendor-status-VDU-8842.json");
    let state = createState();
    state = reducer(state, { type: "IMPORT_MESSAGE", message: status, at });
    expect(state.vendorReportedQty).toBe(800);
    expect(state.vendorFollowUp).toMatch(/still in the furnace/);
    const followUp = state.vendorFollowUp;
    state = reducer(state, { type: "IMPORT_MESSAGE", message: status, at });
    expect(state.vendorFollowUp).toBe(followUp);
    expect(state.appliedMessageIds.filter((id) => id === "VDU-8842")).toHaveLength(1);
    expect(picture(state).customerShort).toBe(260);
  });

  it("writes nothing when the portal times out", () => {
    const failed = reducer(createState(), {
      type: "IMPORT_FAILED",
      messageId: "VDU-8842",
      at,
      simulated: true,
      message: "Simulated timeout. The portal did not answer, so nothing was written.",
    });
    expect(failed.vendorReportedQty).toBe(800);
    expect(failed.appliedMessageIds).toEqual(["VDU-8841"]);
    expect(failed.pendingRetryId).toBe("VDU-8842");
    expect(failed.failureArmed).toBe(false);
    expect(failed.vendorFollowUp).toBeNull();
  });

  it("rejects a dispatch quantity that cannot belong to this job", () => {
    const result = parseVendorMessage({
      messageId: "VDU-9999",
      kind: "dispatch",
      jobRef: "JW-1048",
      dispatchedQty: 1600,
    });
    expect(result.ok).toBe(false);
  });
});

describe("decisions", () => {
  it("updates status and decision quantities without rewriting the source counts", () => {
    const at = "2026-10-30T12:00:00.000Z";
    let state = createState();
    expect(nextActions(state)).toHaveLength(6);
    state = reducer(state, { type: "POST_INSPECTION", note: "Hardness sheet attached.", at });
    state = reducer(state, { type: "SET_DISPOSITION", disposition: "rework", note: "", at });
    state = reducer(state, { type: "RAISE_CLAIM", note: "", at });
    state = reducer(state, { type: "HOLD_INVOICE", note: "", at });
    state = reducer(state, { type: "CHASE_VENDOR", note: "", at });
    state = reducer(state, { type: "NOTIFY_CUSTOMER", note: "", at });

    expect(nextActions(state)).toEqual([]);
    expect(state.vendorReportedQty).toBe(800);
    expect(picture(state)).toMatchObject({
      transitGap: 20,
      stillOut: 200,
      customerShort: 260,
      shippable: 740,
    });
    expect(decisionFigures(state)).toMatchObject({
      claimQty: 20,
      heldQty: 60,
      reworkQty: 40,
      toldCustomerQty: 740,
    });
    expect(state.history[0]?.title).toMatch(/Bharat Axle/);
    expect(state.history.some((item) => item.detail.includes("Hardness sheet attached."))).toBe(true);
  });
});
