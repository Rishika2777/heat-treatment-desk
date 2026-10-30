export const STORAGE_KEY = "shakti-jw-1048-v1";

export const FACTS = {
  scenarioDay: "30 Oct 2026",
  shipDay: "1 Nov 2026",
  daysLeft: 2,
  customer: "Bharat Axle Systems",
  customerPo: "BAS-PO-2291",
  part: "Steering knuckle",
  partNo: "SAC-KN-4418",
  revision: "C",
  operation: "Carburise, quench and temper",
  spec: "58–62 HRC",
  rejectReason: "40 pieces tested at 54–56 HRC",
  vendor: "Deccan Heat Treat Pvt. Ltd.",
  vendorSite: "Chakan",
  plant: "Shakti Auto Components",
  plantSite: "Bhosari, Pune",
  job: "JW-1048",
  challan: "DC-HT-7731",
  grn: "GRN-2194",
  inspection: "QI-318",
  invoice: "DHT/25-26/5520",
  dispatchMessage: "VDU-8841",
  statusMessage: "VDU-8842",
  customerQty: 1000,
  sentQty: 1000,
  receivedQty: 780,
  acceptedQty: 740,
  rejectedQty: 40,
  invoicedQty: 800,
  otherFinishedStock: 0,
} as const;

export type RejectDisposition = "pending" | "rework" | "return" | "scrap";

export type HistoryKind = "record" | "import" | "decision" | "failure";

export type HistoryItem = {
  id: string;
  at: string;
  kind: HistoryKind;
  title: string;
  detail: string;
};

export type ImportResult =
  | { type: "idle" }
  | { type: "duplicate"; messageId: string }
  | { type: "applied"; messageId: string }
  | { type: "failed"; messageId: string; message: string };

export type VendorMessage =
  | {
      kind: "dispatch";
      messageId: string;
      jobRef: string;
      vendor: string;
      challan: string;
      dispatchedQty: number;
      dispatchNote: string;
      reportedAt: string;
      note: string;
    }
  | {
      kind: "status";
      messageId: string;
      jobRef: string;
      vendor: string;
      reportedAt: string;
      note: string;
    };

export type AppState = {
  vendorReportedQty: number;
  appliedMessageIds: string[];
  vendorFollowUp: string | null;
  inspectionPosted: boolean;
  rejectDisposition: RejectDisposition;
  shortageClaim: boolean;
  invoiceHeld: boolean;
  vendorChased: boolean;
  customerNotified: boolean;
  failureArmed: boolean;
  pendingRetryId: string | null;
  lastImport: ImportResult;
  history: HistoryItem[];
};

export type Action =
  | { type: "SET_FAILURE"; armed: boolean }
  | {
      type: "IMPORT_FAILED";
      messageId: string;
      at: string;
      simulated: boolean;
      message: string;
    }
  | { type: "IMPORT_MESSAGE"; message: VendorMessage; at: string }
  | { type: "POST_INSPECTION"; note: string; at: string }
  | {
      type: "SET_DISPOSITION";
      disposition: Exclude<RejectDisposition, "pending">;
      note: string;
      at: string;
    }
  | { type: "RAISE_CLAIM"; note: string; at: string }
  | { type: "HOLD_INVOICE"; note: string; at: string }
  | { type: "CHASE_VENDOR"; note: string; at: string }
  | { type: "NOTIFY_CUSTOMER"; note: string; at: string }
  | { type: "RESET" };

export function formatQty(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function picture(state: AppState) {
  const vendor = state.vendorReportedQty;
  const stillOut = FACTS.sentQty - vendor;
  const transitGap = vendor - FACTS.receivedQty;
  const shippable = FACTS.acceptedQty + FACTS.otherFinishedStock;
  const customerShort = FACTS.customerQty - shippable;
  const invoiceAboveAccepted = FACTS.invoicedQty - FACTS.acceptedQty;
  const invoiceAboveReceived = FACTS.invoicedQty - FACTS.receivedQty;
  return {
    vendor,
    stillOut,
    transitGap,
    shippable,
    customerShort,
    invoiceAboveAccepted,
    invoiceAboveReceived,
  };
}

export function decisionFigures(state: AppState) {
  const gaps = picture(state);
  return {
    claimQty: state.shortageClaim ? Math.max(gaps.transitGap, 0) : 0,
    heldQty: state.invoiceHeld ? gaps.invoiceAboveAccepted : 0,
    reworkQty: state.rejectDisposition === "rework" ? FACTS.rejectedQty : 0,
    returnQty: state.rejectDisposition === "return" ? FACTS.rejectedQty : 0,
    scrapQty: state.rejectDisposition === "scrap" ? FACTS.rejectedQty : 0,
    toldCustomerQty: state.customerNotified ? FACTS.acceptedQty : 0,
  };
}

export type NextAction = {
  id: string;
  title: string;
  detail: string;
};

export function nextActions(state: AppState): NextAction[] {
  const gaps = picture(state);
  const items: NextAction[] = [];
  if (!state.inspectionPosted) {
    items.push({
      id: "inspect",
      title: "Post inspection QI-318",
      detail: `${formatQty(FACTS.acceptedQty)} accepted and ${formatQty(FACTS.rejectedQty)} rejected are on the quality slip. Post them on this job.`,
    });
  }
  if (state.rejectDisposition === "pending") {
    items.push({
      id: "disposition",
      title: "Decide the 40 low-hardness pieces",
      detail: FACTS.rejectReason + ". Send them for rework, return them, or scrap them.",
    });
  }
  if (gaps.transitGap > 0 && !state.shortageClaim) {
    items.push({
      id: "claim",
      title: `Raise a shortage claim for ${formatQty(gaps.transitGap)}`,
      detail: `Vendor message ${FACTS.dispatchMessage} says ${formatQty(gaps.vendor)}. ${FACTS.grn} counted ${formatQty(FACTS.receivedQty)}.`,
    });
  }
  if (!state.invoiceHeld) {
    items.push({
      id: "invoice",
      title: "Hold the vendor invoice",
      detail: `${FACTS.invoice} bills ${formatQty(FACTS.invoicedQty)}. Quality accepted ${formatQty(FACTS.acceptedQty)}. Leave the bill as it is and block payment of the difference.`,
    });
  }
  if (gaps.stillOut > 0 && !state.vendorChased) {
    items.push({
      id: "chase",
      title: `Chase ${formatQty(gaps.stillOut)} pieces still out`,
      detail: `${formatQty(FACTS.sentQty)} left on challan ${FACTS.challan}. The vendor has reported ${formatQty(gaps.vendor)}.`,
    });
  }
  if (!state.customerNotified) {
    items.push({
      id: "customer",
      title: `Warn ${FACTS.customer}`,
      detail: `Only ${formatQty(gaps.shippable)} can ship on ${FACTS.shipDay}. The order is short by ${formatQty(gaps.customerShort)}.`,
    });
  }
  return items;
}

function withNote(detail: string, note: string): string {
  const trimmed = note.trim();
  return trimmed ? `${detail} Note: ${trimmed}` : detail;
}

function remember(state: AppState, item: HistoryItem): AppState {
  return { ...state, history: [item, ...state.history] };
}

export function createState(): AppState {
  return {
    vendorReportedQty: 800,
    appliedMessageIds: [FACTS.dispatchMessage],
    vendorFollowUp: null,
    inspectionPosted: false,
    rejectDisposition: "pending",
    shortageClaim: false,
    invoiceHeld: false,
    vendorChased: false,
    customerNotified: false,
    failureArmed: false,
    pendingRetryId: null,
    lastImport: { type: "idle" },
    history: [
      {
        id: "seed-qi",
        at: "2026-10-30T08:40:00+05:30",
        kind: "record",
        title: "Quality slip QI-318 filled in",
        detail:
          "740 accepted and 40 rejected. Hardness on the rejected pieces is 54–56 HRC. The production manager has not posted this on the job yet.",
      },
      {
        id: "seed-grn",
        at: "2026-10-29T21:05:00+05:30",
        kind: "record",
        title: "Warehouse counted GRN-2194",
        detail: "Incoming stores counted 780 pieces. The vendor message said 800. Both figures were kept.",
      },
      {
        id: "seed-import",
        at: "2026-10-29T18:10:00+05:30",
        kind: "import",
        title: "Vendor dispatch VDU-8841 imported",
        detail:
          "Reported dispatch was set to 800. Message id VDU-8841 was stored so the same file cannot be added again.",
      },
      {
        id: "seed-invoice",
        at: "2026-10-29T16:20:00+05:30",
        kind: "record",
        title: "Invoice DHT/25-26/5520 arrived",
        detail: "Deccan billed heat treatment for 800 pieces. Payment has not been held yet.",
      },
      {
        id: "seed-challan",
        at: "2026-10-24T11:20:00+05:30",
        kind: "record",
        title: "Challan DC-HT-7731 sent",
        detail: "1,000 steering knuckles left Bhosari for Deccan Heat Treat, Chakan.",
      },
    ],
  };
}

export function parseVendorMessage(
  input: unknown,
): { ok: true; message: VendorMessage } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "The file was not a vendor message. No quantity was changed." };
  }
  const data = input as Record<string, unknown>;
  if (data.jobRef !== FACTS.job) {
    return { ok: false, error: `This message is not for job ${FACTS.job}. No quantity was changed.` };
  }
  if (typeof data.messageId !== "string" || data.messageId.trim() === "") {
    return { ok: false, error: "The message has no id. No quantity was changed." };
  }
  const messageId = data.messageId.trim();
  const vendor = typeof data.vendor === "string" ? data.vendor : FACTS.vendor;
  const reportedAt = typeof data.reportedAt === "string" ? data.reportedAt : new Date().toISOString();

  if (data.kind === "dispatch") {
    if (typeof data.dispatchedQty !== "number" || !Number.isInteger(data.dispatchedQty)) {
      return { ok: false, error: "Dispatch quantity is missing. No quantity was changed." };
    }
    if (data.dispatchedQty < 0 || data.dispatchedQty > FACTS.sentQty) {
      return {
        ok: false,
        error: `Dispatch quantity must be a whole number from 0 to ${formatQty(FACTS.sentQty)}. No quantity was changed.`,
      };
    }
    return {
      ok: true,
      message: {
        kind: "dispatch",
        messageId,
        jobRef: FACTS.job,
        vendor,
        challan: typeof data.challan === "string" ? data.challan : FACTS.challan,
        dispatchedQty: data.dispatchedQty,
        dispatchNote: typeof data.dispatchNote === "string" ? data.dispatchNote : "",
        reportedAt,
        note: typeof data.note === "string" ? data.note : "",
      },
    };
  }

  if (data.kind === "status") {
    if (typeof data.note !== "string" || data.note.trim() === "") {
      return { ok: false, error: "Status message has no note. No quantity was changed." };
    }
    return {
      ok: true,
      message: {
        kind: "status",
        messageId,
        jobRef: FACTS.job,
        vendor,
        reportedAt,
        note: data.note.trim(),
      },
    };
  }

  return { ok: false, error: "Unknown message kind. No quantity was changed." };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_FAILURE":
      return { ...state, failureArmed: action.armed };
    case "IMPORT_FAILED":
      return remember(
        {
          ...state,
          failureArmed: false,
          pendingRetryId: action.messageId,
          lastImport: { type: "failed", messageId: action.messageId, message: action.message },
        },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "failure",
          title: action.simulated ? "Simulated vendor-portal timeout" : "Vendor import did not complete",
          detail: `${action.message} Vendor-reported dispatch stays ${formatQty(state.vendorReportedQty)}.`,
        },
      );
    case "IMPORT_MESSAGE": {
      const message = action.message;
      if (state.appliedMessageIds.includes(message.messageId)) {
        return remember(
          {
            ...state,
            failureArmed: false,
            pendingRetryId: null,
            lastImport: { type: "duplicate", messageId: message.messageId },
          },
          {
            id: crypto.randomUUID(),
            at: action.at,
            kind: "import",
            title: `Repeat import ignored (${message.messageId})`,
            detail: `This message is already stored. Vendor-reported dispatch stays ${formatQty(state.vendorReportedQty)}.`,
          },
        );
      }
      if (message.kind === "dispatch") {
        return remember(
          {
            ...state,
            vendorReportedQty: message.dispatchedQty,
            appliedMessageIds: [...state.appliedMessageIds, message.messageId],
            failureArmed: false,
            pendingRetryId: null,
            lastImport: { type: "applied", messageId: message.messageId },
          },
          {
            id: crypto.randomUUID(),
            at: action.at,
            kind: "import",
            title: `Vendor dispatch ${message.messageId} imported`,
            detail: `Reported dispatch was set to ${formatQty(message.dispatchedQty)}. The same message cannot be added on top.`,
          },
        );
      }
      return remember(
        {
          ...state,
          vendorFollowUp: message.note,
          appliedMessageIds: [...state.appliedMessageIds, message.messageId],
          failureArmed: false,
          pendingRetryId: null,
          lastImport: { type: "applied", messageId: message.messageId },
        },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "import",
          title: `Vendor status ${message.messageId} imported`,
          detail: message.note,
        },
      );
    }
    case "POST_INSPECTION":
      if (state.inspectionPosted) return state;
      return remember(
        { ...state, inspectionPosted: true },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "decision",
          title: "Inspection QI-318 posted",
          detail: withNote(
            `Accepted ${formatQty(FACTS.acceptedQty)} and rejected ${formatQty(FACTS.rejectedQty)}. Vendor dispatch and the invoice were left as they are.`,
            action.note,
          ),
        },
      );
    case "SET_DISPOSITION": {
      if (state.rejectDisposition === action.disposition) return state;
      const label =
        action.disposition === "rework"
          ? "Send the 40 rejects back for rework"
          : action.disposition === "return"
            ? "Return the 40 rejects to Deccan"
            : "Scrap the 40 rejects at Bhosari";
      return remember(
        { ...state, rejectDisposition: action.disposition },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "decision",
          title: label,
          detail: withNote(
            "The rejected quantity stays 40. Accepted stays 740. The vendor message and the invoice were not changed.",
            action.note,
          ),
        },
      );
    }
    case "RAISE_CLAIM":
      if (state.shortageClaim) return state;
      return remember(
        { ...state, shortageClaim: true },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "decision",
          title: `Shortage claim raised for ${formatQty(picture(state).transitGap)}`,
          detail: withNote(
            `${FACTS.dispatchMessage} stays at ${formatQty(state.vendorReportedQty)}. ${FACTS.grn} stays at ${formatQty(FACTS.receivedQty)}.`,
            action.note,
          ),
        },
      );
    case "HOLD_INVOICE":
      if (state.invoiceHeld) return state;
      return remember(
        { ...state, invoiceHeld: true },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "decision",
          title: "Invoice payment held",
          detail: withNote(
            `${FACTS.invoice} still bills ${formatQty(FACTS.invoicedQty)}. Pay ${formatQty(FACTS.acceptedQty)} under our rule. Hold back ${formatQty(picture(state).invoiceAboveAccepted)}.`,
            action.note,
          ),
        },
      );
    case "CHASE_VENDOR":
      if (state.vendorChased) return state;
      return remember(
        { ...state, vendorChased: true },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "decision",
          title: `Deccan chased for ${formatQty(picture(state).stillOut)} pieces`,
          detail: withNote(
            `${formatQty(FACTS.sentQty)} were sent and ${formatQty(state.vendorReportedQty)} have been reported. The open balance stays on the job.`,
            action.note,
          ),
        },
      );
    case "NOTIFY_CUSTOMER":
      if (state.customerNotified) return state;
      return remember(
        { ...state, customerNotified: true },
        {
          id: crypto.randomUUID(),
          at: action.at,
          kind: "decision",
          title: `${FACTS.customer} warned`,
          detail: withNote(
            `Offered a partial shipment of ${formatQty(FACTS.acceptedQty)} against ${FACTS.customerPo}. The order is still short by ${formatQty(picture(state).customerShort)} for ${FACTS.shipDay}.`,
            action.note,
          ),
        },
      );
    case "RESET":
      return createState();
    default:
      return state;
  }
}

export function hydrate(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") return createState();
  const envelope = raw as { version?: number; state?: AppState };
  if (envelope.version !== 1 || !envelope.state) return createState();
  const saved = envelope.state;
  if (typeof saved.vendorReportedQty !== "number" || !Array.isArray(saved.appliedMessageIds)) {
    return createState();
  }
  if (!Array.isArray(saved.history)) return createState();
  return { ...createState(), ...saved };
}

export function loadState(storage: Pick<Storage, "getItem">): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createState();
    return hydrate(JSON.parse(raw));
  } catch {
    return createState();
  }
}

export function saveState(storage: Pick<Storage, "setItem">, state: AppState) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state }));
}

export function dispositionLabel(value: RejectDisposition): string {
  switch (value) {
    case "pending":
      return "Not decided";
    case "rework":
      return "Rework at Deccan";
    case "return":
      return "Return to Deccan";
    case "scrap":
      return "Scrap at Bhosari";
  }
}
