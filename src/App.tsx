import { useEffect, useReducer, useState } from "react";
import {
  FACTS,
  decisionFigures,
  dispositionLabel,
  formatQty,
  formatWhen,
  loadState,
  nextActions,
  parseVendorMessage,
  picture,
  reducer,
  saveState,
  type Action,
  type AppState,
} from "./domain";

type View = "overview" | "sources" | "decisions" | "import" | "history" | "about";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "See the quantities and the customer risk." },
  { id: "sources", label: "Three sources", hint: "Vendor, warehouse, and quality stay separate." },
  { id: "decisions", label: "Decisions", hint: "Record what to do. The original counts stay the same." },
  { id: "import", label: "Vendor import", hint: "Practice loading a vendor file. This is not a live portal." },
  { id: "history", label: "History", hint: "What has already happened on this job." },
  { id: "about", label: "About", hint: "Assumptions, research, and limits of this sample." },
];

function useJob() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState(window.localStorage));
  useEffect(() => {
    saveState(window.localStorage, state);
  }, [state]);
  return [state, dispatch] as const;
}

export function App() {
  const [state, dispatch] = useJob();
  const [view, setView] = useState<View>("overview");
  const gaps = picture(state);
  const open = nextActions(state);
  const page = VIEWS.find((item) => item.id === view) ?? VIEWS[0];

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="mark" aria-hidden="true">
            SA
          </span>
          <div>
            <strong>Shakti Auto</strong>
            <span>Heat treatment desk</span>
          </div>
        </div>
        <div className="job-chip">
          <span>Job {FACTS.job}</span>
          <strong>{FACTS.part}</strong>
          <em>
            {FACTS.partNo} · Rev {FACTS.revision}
          </em>
        </div>
        <nav>
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "nav active" : "nav"}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
              {item.id === "decisions" && open.length > 0 ? <span className="badge">{open.length}</span> : null}
            </button>
          ))}
        </nav>
        <dl className="side-stats">
          <div>
            <dt>Can ship</dt>
            <dd data-testid="shippable">{formatQty(gaps.shippable)}</dd>
          </div>
          <div>
            <dt>Short</dt>
            <dd data-testid="customer-short">{formatQty(gaps.customerShort)}</dd>
          </div>
          <div>
            <dt>Vendor says</dt>
            <dd data-testid="vendor-qty">{formatQty(state.vendorReportedQty)}</dd>
          </div>
        </dl>
        <button type="button" className="restore" onClick={() => dispatch({ type: "RESET" })}>
          Restore opening job
        </button>
        <p className="aside-foot">Sample job. Saved in this browser only.</p>
      </aside>
      <main>
        <header className="top">
          <div>
            <p className="crumb">
              {FACTS.part} for {FACTS.customer} · PO {FACTS.customerPo}
            </p>
            <h2>{page.label}</h2>
            <p className="lede">{page.hint}</p>
          </div>
          <p className="due">
            <span>Ship date</span>
            <strong>{FACTS.shipDay}</strong>
            <em>{FACTS.daysLeft} days left</em>
          </p>
        </header>
        {view === "overview" && <Overview state={state} onOpen={() => setView("decisions")} />}
        {view === "sources" && <Sources state={state} />}
        {view === "decisions" && <Decisions state={state} dispatch={dispatch} />}
        {view === "import" && <ImportDesk state={state} dispatch={dispatch} />}
        {view === "history" && <History state={state} />}
        {view === "about" && <About />}
      </main>
    </div>
  );
}

function Overview({ state, onOpen }: { state: AppState; onOpen: () => void }) {
  const gaps = picture(state);
  const made = decisionFigures(state);
  const actions = nextActions(state);

  return (
    <div className="stack">
      <section className="risk">
        <p className="kicker">Customer delivery</p>
        <h3>
          Short by {formatQty(gaps.customerShort)} for {FACTS.shipDay}
        </h3>
        <p>
          {FACTS.customer} ordered {formatQty(FACTS.customerQty)}. We can ship {formatQty(gaps.shippable)}. Other
          finished stock of {FACTS.partNo} is {formatQty(FACTS.otherFinishedStock)}.{" "}
          {state.customerNotified
            ? `They have been offered ${formatQty(FACTS.acceptedQty)}.`
            : "They have not been told yet."}
        </p>
      </section>

      <section>
        <div className="section-head">
          <h3>Follow the pieces</h3>
          <p>Each box is a different document. The numbers are not edited to match.</p>
        </div>
        <ol className="flow">
          <FlowItem label="Customer order" qty={FACTS.customerQty} source={FACTS.customerPo} />
          <FlowItem label="Sent to vendor" qty={FACTS.sentQty} source={FACTS.challan} />
          <FlowItem label="Vendor reports" qty={state.vendorReportedQty} source={FACTS.dispatchMessage} drop />
          <FlowItem label="Warehouse counted" qty={FACTS.receivedQty} source={FACTS.grn} drop />
          <FlowItem label="Quality accepted" qty={FACTS.acceptedQty} source={FACTS.inspection} drop />
        </ol>
        <p className="reject-line">
          Quality rejected <strong>{formatQty(FACTS.rejectedQty)}</strong> on {FACTS.inspection}. {FACTS.rejectReason}.
          Status: {dispositionLabel(state.rejectDisposition)}.
        </p>
      </section>

      <section>
        <div className="section-head">
          <h3>What does not match</h3>
        </div>
        <div className="gaps">
          <Gap
            title={`${formatQty(gaps.stillOut)} still not reported`}
            math={`${formatQty(FACTS.sentQty)} sent − ${formatQty(gaps.vendor)} reported`}
          />
          <Gap
            title={`${formatQty(gaps.transitGap)} missing at the dock`}
            math={`${formatQty(gaps.vendor)} reported − ${formatQty(FACTS.receivedQty)} counted`}
          />
          <Gap
            title={`${formatQty(FACTS.rejectedQty)} failed inspection`}
            math={`${formatQty(FACTS.receivedQty)} counted − ${formatQty(FACTS.acceptedQty)} accepted`}
          />
          <Gap
            title={`${formatQty(gaps.invoiceAboveAccepted)} on the bill above accepted`}
            math={`${formatQty(FACTS.invoicedQty)} billed − ${formatQty(FACTS.acceptedQty)} accepted`}
          />
        </div>
      </section>

      {state.vendorFollowUp ? (
        <section className="sim-note">
          <p className="kicker">Simulation · {FACTS.statusMessage}</p>
          <p>{state.vendorFollowUp}</p>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h3>What you have decided</h3>
          <p>These numbers change when you act. The counts above stay the same.</p>
        </div>
        <dl className="decisions-row">
          <Figure label="Claim qty" value={made.claimQty} testId="claim-qty" />
          <Figure label="Held back on the bill" value={made.heldQty} testId="held-qty" />
          <Figure
            label={
              state.rejectDisposition === "return"
                ? "Returned to vendor"
                : state.rejectDisposition === "scrap"
                  ? "Scrapped here"
                  : "Sent for rework"
            }
            value={state.rejectDisposition === "pending" ? 0 : FACTS.rejectedQty}
            testId="reject-assigned"
          />
          <Figure label="Customer told we can ship" value={made.toldCustomerQty} testId="told-qty" />
        </dl>
      </section>

      <section>
        <div className="section-head">
          <h3>Do this next</h3>
          <button type="button" className="text-btn" onClick={onOpen}>
            Go to decisions
          </button>
        </div>
        {actions.length === 0 ? (
          <p className="calm" data-testid="next-actions">
            Follow-up is filed. The counts still disagree, and the {FACTS.shipDay} shipment is still short by{" "}
            {formatQty(gaps.customerShort)}.
          </p>
        ) : (
          <ul className="actions" data-testid="next-actions">
            {actions.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <button type="button" onClick={onOpen}>
                  Record
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FlowItem({
  label,
  qty,
  source,
  drop = false,
}: {
  label: string;
  qty: number;
  source: string;
  drop?: boolean;
}) {
  return (
    <li className={drop ? "drop" : undefined}>
      <span>{label}</span>
      <strong>{formatQty(qty)}</strong>
      <em>{source}</em>
    </li>
  );
}

function Gap({ title, math }: { title: string; math: string }) {
  return (
    <article>
      <h4>{title}</h4>
      <p>{math}</p>
    </article>
  );
}

function Figure({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-testid={testId}>{formatQty(value)}</dd>
    </div>
  );
}

function Sources({ state }: { state: AppState }) {
  const rows = [
    ["Customer order", formatQty(FACTS.customerQty), FACTS.customerPo, FACTS.customer, "Demand"],
    ["Sent for heat treatment", formatQty(FACTS.sentQty), FACTS.challan, "Our stores, 24 Oct 2026", "Our document"],
    [
      "Vendor dispatch",
      formatQty(state.vendorReportedQty),
      FACTS.dispatchMessage,
      `${FACTS.vendor}, 29 Oct 2026`,
      "Vendor message",
    ],
    ["Warehouse receipt", formatQty(FACTS.receivedQty), FACTS.grn, "Incoming stores, 29 Oct 2026", "Our count"],
    [
      "Accepted",
      formatQty(FACTS.acceptedQty),
      FACTS.inspection,
      state.inspectionPosted ? "Quality desk · posted" : "Quality desk · not posted yet",
      "Our inspection",
    ],
    [
      "Rejected",
      formatQty(FACTS.rejectedQty),
      FACTS.inspection,
      dispositionLabel(state.rejectDisposition),
      "Our inspection",
    ],
    [
      "Vendor invoice",
      formatQty(FACTS.invoicedQty),
      FACTS.invoice,
      state.invoiceHeld ? "Payment held" : "Bill received, payment open",
      "Vendor bill",
    ],
    ["Other finished stock", formatQty(FACTS.otherFinishedStock), "Stock check", "Finished stores", "Our stock"],
    [
      "Can ship on 1 Nov",
      formatQty(FACTS.acceptedQty + FACTS.otherFinishedStock),
      FACTS.customerPo,
      state.customerNotified ? "Customer has been warned" : "Customer not told",
      "Calculated",
    ],
  ];

  return (
    <div className="stack">
      <section className="section-head">
        <h3>Read each count on its own</h3>
        <p>The vendor message, the warehouse count, and the inspection are three different records.</p>
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Measure</th>
              <th>Quantity</th>
              <th>Document</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="source-cards">
        <article>
          <p className="tag vendor">Vendor</p>
          <h3>{formatQty(state.vendorReportedQty)} dispatched</h3>
          <p>
            Message {FACTS.dispatchMessage}, note HT-OUT-441. {FACTS.vendor} also billed {formatQty(FACTS.invoicedQty)}{" "}
            on {FACTS.invoice}.
          </p>
        </article>
        <article>
          <p className="tag warehouse">Warehouse</p>
          <h3>{formatQty(FACTS.receivedQty)} counted</h3>
          <p>
            {FACTS.grn} at {FACTS.plantSite}. This count is {formatQty(state.vendorReportedQty - FACTS.receivedQty)}{" "}
            below the vendor message.
          </p>
        </article>
        <article>
          <p className="tag quality">Quality</p>
          <h3>
            {formatQty(FACTS.acceptedQty)} good · {formatQty(FACTS.rejectedQty)} held
          </h3>
          <p>
            {FACTS.inspection}. {FACTS.rejectReason}. {state.inspectionPosted ? "Posted on the job." : "Slip filled in, waiting to be posted."}
          </p>
        </article>
      </div>
    </div>
  );
}

function Decisions({ state, dispatch }: { state: AppState; dispatch: (action: Action) => void }) {
  const gaps = picture(state);
  const at = () => new Date().toISOString();

  return (
    <div className="stack">
      <section className="section-head">
        <h3>Pick one action at a time</h3>
        <p>Each button files a decision and adds it to History. It does not change the source counts.</p>
      </section>
      <DecisionCard
        title="Post the inspection"
        body={`${FACTS.inspection}: ${formatQty(FACTS.acceptedQty)} accepted, ${formatQty(FACTS.rejectedQty)} rejected. ${FACTS.rejectReason}.`}
        done={state.inspectionPosted}
        doneLabel="Inspection posted"
        actionLabel="Post inspection QI-318"
        onAct={(note) => dispatch({ type: "POST_INSPECTION", note, at: at() })}
      />
      <article className="card">
        <h3>The 40 rejected pieces</h3>
        <p>Choose a path. Accepted stays {formatQty(FACTS.acceptedQty)} and rejected stays {formatQty(FACTS.rejectedQty)}.</p>
        <p className="status-line">Now: {dispositionLabel(state.rejectDisposition)}</p>
        <div className="choice-row">
          <Choice
            pressed={state.rejectDisposition === "rework"}
            label="Send the 40 rejects back for rework"
            onClick={() => dispatch({ type: "SET_DISPOSITION", disposition: "rework", note: "", at: at() })}
          />
          <Choice
            pressed={state.rejectDisposition === "return"}
            label="Return the 40 rejects to Deccan"
            onClick={() => dispatch({ type: "SET_DISPOSITION", disposition: "return", note: "", at: at() })}
          />
          <Choice
            pressed={state.rejectDisposition === "scrap"}
            label="Scrap the 40 rejects at Bhosari"
            onClick={() => dispatch({ type: "SET_DISPOSITION", disposition: "scrap", note: "", at: at() })}
          />
        </div>
      </article>
      <DecisionCard
        title={`Shortage of ${formatQty(gaps.transitGap)} at the dock`}
        body={`${FACTS.dispatchMessage} says ${formatQty(gaps.vendor)}. ${FACTS.grn} says ${formatQty(FACTS.receivedQty)}. Raising a claim keeps both numbers.`}
        done={state.shortageClaim}
        doneLabel="Shortage claim raised"
        actionLabel={`Raise shortage claim for ${formatQty(gaps.transitGap)}`}
        onAct={(note) => dispatch({ type: "RAISE_CLAIM", note, at: at() })}
      />
      <DecisionCard
        title="Vendor invoice"
        body={`${FACTS.invoice} bills ${formatQty(FACTS.invoicedQty)}. Our rule, stated as an assumption: pay ${formatQty(FACTS.acceptedQty)} accepted pieces and hold back ${formatQty(gaps.invoiceAboveAccepted)}. The bill quantity is not rewritten.`}
        done={state.invoiceHeld}
        doneLabel="Invoice payment held"
        actionLabel="Hold the invoice"
        onAct={(note) => dispatch({ type: "HOLD_INVOICE", note, at: at() })}
      />
      <DecisionCard
        title={`${formatQty(gaps.stillOut)} pieces still at the vendor or unreported`}
        body={`${formatQty(FACTS.sentQty)} went on ${FACTS.challan}. ${formatQty(gaps.vendor)} have been reported back. The open balance stays on the job.`}
        done={state.vendorChased}
        doneLabel="Vendor chased"
        actionLabel={`Chase the ${formatQty(gaps.stillOut)} still out`}
        onAct={(note) => dispatch({ type: "CHASE_VENDOR", note, at: at() })}
      />
      <DecisionCard
        title={`${FACTS.customer} shipment`}
        body={`Offer ${formatQty(FACTS.acceptedQty)} against ${FACTS.customerPo}. The order remains short by ${formatQty(gaps.customerShort)} on ${FACTS.shipDay}.`}
        done={state.customerNotified}
        doneLabel="Customer warned"
        actionLabel="Warn Bharat Axle"
        onAct={(note) => dispatch({ type: "NOTIFY_CUSTOMER", note, at: at() })}
      />
    </div>
  );
}

function DecisionCard({
  title,
  body,
  done,
  doneLabel,
  actionLabel,
  onAct,
}: {
  title: string;
  body: string;
  done: boolean;
  doneLabel: string;
  actionLabel: string;
  onAct: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <article className={done ? "card done" : "card"}>
      <h3>{title}</h3>
      <p>{body}</p>
      {done ? (
        <p className="status-line">{doneLabel}</p>
      ) : (
        <>
          <label>
            Note, optional
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button type="button" onClick={() => onAct(note)}>
            {actionLabel}
          </button>
        </>
      )}
    </article>
  );
}

function Choice({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={pressed} className={pressed ? "choice on" : "choice"} onClick={onClick}>
      {label}
    </button>
  );
}

function ImportDesk({ state, dispatch }: { state: AppState; dispatch: (action: Action) => void }) {
  const [busy, setBusy] = useState(false);

  async function runImport(messageId: string) {
    const at = new Date().toISOString();
    if (state.failureArmed) {
      dispatch({
        type: "IMPORT_FAILED",
        messageId,
        at,
        simulated: true,
        message: "Simulated timeout. The portal did not answer, so nothing was written.",
      });
      return;
    }
    setBusy(true);
    try {
      const file =
        messageId === FACTS.dispatchMessage
          ? "/fixtures/vendor-dispatch-VDU-8841.json"
          : "/fixtures/vendor-status-VDU-8842.json";
      const response = await fetch(file);
      if (!response.ok) {
        dispatch({
          type: "IMPORT_FAILED",
          messageId,
          at,
          simulated: false,
          message: "The fixture file could not be read. No quantity was changed.",
        });
        return;
      }
      const parsed = parseVendorMessage(await response.json());
      if (!parsed.ok) {
        dispatch({
          type: "IMPORT_FAILED",
          messageId,
          at,
          simulated: false,
          message: parsed.error,
        });
        return;
      }
      if (parsed.message.messageId !== messageId) {
        dispatch({
          type: "IMPORT_FAILED",
          messageId,
          at,
          simulated: false,
          message: "The file's message id does not match this button. Nothing was written.",
        });
        return;
      }
      dispatch({ type: "IMPORT_MESSAGE", message: parsed.message, at });
    } catch {
      dispatch({
        type: "IMPORT_FAILED",
        messageId,
        at,
        simulated: false,
        message: "The fixture file could not be read. No quantity was changed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="sim-banner">
        <p className="kicker">Simulation</p>
        <h3>Deccan’s portal is a JSON file on this computer</h3>
        <p>No live account is connected. Import reads a local fixture. A dispatch file is the vendor’s total so far. It is not added to the quantity already on the job. The same message id is stored and skipped the next time.</p>
      </section>
      <section className="card">
        <h3>Files</h3>
        <ul className="files">
          <li>
            <code>public/fixtures/vendor-dispatch-VDU-8841.json</code>
            <span>Dispatch snapshot, message {FACTS.dispatchMessage}, quantity 800. Already on the job.</span>
          </li>
          <li>
            <code>public/fixtures/vendor-status-VDU-8842.json</code>
            <span>Status note only. It does not change any quantity.</span>
          </li>
        </ul>
        <p>
          Message ids stored:{" "}
          <span data-testid="applied-ids">{state.appliedMessageIds.join(" ")}</span>
        </p>
        <p>
          Vendor-reported dispatch now: <strong data-testid="import-vendor-qty">{formatQty(state.vendorReportedQty)}</strong>
        </p>
      </section>
      <section className="card">
        <label className="check">
          <input
            type="checkbox"
            checked={state.failureArmed}
            onChange={(event) => dispatch({ type: "SET_FAILURE", armed: event.target.checked })}
          />
          Simulate a timeout on the next import
        </label>
        <div className="button-row">
          <button type="button" disabled={busy} onClick={() => void runImport(FACTS.dispatchMessage)}>
            Import dispatch VDU-8841
          </button>
          <button type="button" disabled={busy} onClick={() => void runImport(FACTS.statusMessage)}>
            Import status VDU-8842
          </button>
          {state.pendingRetryId ? (
            <button type="button" className="retry" disabled={busy} onClick={() => void runImport(state.pendingRetryId!)}>
              Retry import
            </button>
          ) : null}
        </div>
        <ImportResult state={state} />
        {state.vendorFollowUp ? (
          <div className="follow">
            <p className="kicker">Latest vendor follow-up</p>
            <p>{state.vendorFollowUp}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ImportResult({ state }: { state: AppState }) {
  const result = state.lastImport;
  if (result.type === "idle") {
    return (
      <p className="result idle" data-testid="import-result">
        No import has been run since the job was opened. Dispatch {FACTS.dispatchMessage} is already stored at{" "}
        {formatQty(state.vendorReportedQty)}.
      </p>
    );
  }
  if (result.type === "failed") {
    return (
      <p className="result bad" data-testid="import-result">
        {result.message} Vendor-reported dispatch is still {formatQty(state.vendorReportedQty)}.
      </p>
    );
  }
  if (result.type === "duplicate") {
    return (
      <p className="result ok" data-testid="import-result">
        Already imported ({result.messageId}). Vendor-reported dispatch stays {formatQty(state.vendorReportedQty)}.
      </p>
    );
  }
  return (
    <p className="result ok" data-testid="import-result">
      Imported {result.messageId} once. Vendor-reported dispatch is {formatQty(state.vendorReportedQty)}.
    </p>
  );
}

function History({ state }: { state: AppState }) {
  return (
    <div className="stack">
      <section className="section-head">
        <h3>History</h3>
        <p>Newest first. Opening records explain how the job reached today’s figures.</p>
      </section>
      <ol className="timeline">
        {state.history.map((item) => (
          <li key={item.id} className={item.kind}>
            <time dateTime={item.at}>{formatWhen(item.at)}</time>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function About() {
  return (
    <div className="stack prose">
      <section>
        <h3>What this screen is for</h3>
        <p>
          Shakti Auto Components sent steering knuckles out for heat treatment. The vendor, the warehouse, quality, and
          the vendor’s invoice do not agree. This desk shows the disagreement and records what the production manager
          does next. It is a browser prototype with sample data.
        </p>
      </section>
      <section>
        <h3>Assumptions</h3>
        <ul>
          <li>One knuckle needs one heat-treatment cycle. No extra loss is planned, so 1,000 sent should come back unless they are still out, missing, or rejected.</li>
          <li>We pay Deccan for pieces our quality desk accepted (740), not for the 800 on their invoice. That commercial rule is ours. Their bill stays at 800.</li>
          <li>Low hardness is treated as the vendor’s process, so the 40 rejects are not payable until a later accepted receipt. This prototype does not receive that later lot.</li>
          <li>A vendor dispatch file is their cumulative total, not a new carton to add.</li>
          <li>There is no other finished stock. The scenario day is fixed at 30 Oct 2026 so the shipment stays two days out, on 1 Nov 2026.</li>
        </ul>
      </section>
      <section>
        <h3>What shaped the screen</h3>
        <p>
          ERPNext keeps material sent to a subcontractor, the subcontracting receipt, quality inspection, and the
          purchase invoice as separate documents. Odoo’s resupply subcontracting flow likewise separates the component
          issue, the receipt, and the vendor bill. Quality checks are their own step. That is why this job never lets
          one source overwrite another, and why the 200 pieces not yet reported stay open.
        </p>
        <p>
          Neither product’s manual gave a single desk for a vendor portal message that disagrees with the dock and with
          inspection. That comparison, and the rule that the same portal message cannot be counted twice, is the part
          built here.
        </p>
        <ul>
          <li>
            <a href="https://docs.frappe.io/erpnext/subcontracting">ERPNext subcontracting</a>
          </li>
          <li>
            <a href="https://docs.frappe.io/erpnext/quality-inspection">ERPNext quality inspection</a>
          </li>
          <li>
            <a href="https://docs.frappe.io/erpnext/purchase-receipt">ERPNext purchase receipt</a>
          </li>
          <li>
            <a href="https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/subcontracting/subcontracting_resupply.html">
              Odoo 19 resupply subcontracting
            </a>
          </li>
          <li>
            <a href="https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/quality/quality_management/quality_checks.html">
              Odoo 19 quality checks
            </a>
          </li>
        </ul>
      </section>
      <section>
        <h3>Limits</h3>
        <ul>
          <li>One sample job. Data stays in this browser.</li>
          <li>The vendor link, the timeout, and the retry are simulated.</li>
          <li>No accounts are posted and no GST document is filed.</li>
          <li>The written integration plan is <code>docs/INTEGRATION_PLAN.md</code> in the project folder.</li>
        </ul>
      </section>
    </div>
  );
}
