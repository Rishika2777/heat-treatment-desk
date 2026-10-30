# Heat-treatment reconciliation — JW-1048

Browser prototype for a small auto-parts factory in Pune. One customer order has come back from an outside heat-treatment vendor with the quantities out of agreement. The screen keeps every figure, shows the delivery risk, and lets a production manager record what to do next.

Task 2, the integration plan, is in [docs/INTEGRATION_PLAN.md](docs/INTEGRATION_PLAN.md).

## Run it

```bash
npm install
npm test
npm run dev
```

Open the local address Vite prints (usually `http://localhost:5173`).

`npm test` checks the quantities, the duplicate import, the simulated timeout, and the decision updates. `npm run build` makes a static build in `dist`.

Data is saved in this browser only. **Restore opening job** in the sidebar puts the sample job back.

## The job

Shakti Auto Components, Bhosari, sent steering knuckles (`SAC-KN-4418`, Rev C) to Deccan Heat Treat, Chakan. Bharat Axle Systems needs the finished parts on **1 Nov 2026**. The scenario day is **30 Oct 2026**. There is no other finished stock.

| Document | Who owns it | Quantity |
|---|---|---|
| Customer PO `BAS-PO-2291` | Bharat Axle | 1,000 |
| Challan `DC-HT-7731` | Our stores | 1,000 sent |
| Vendor message `VDU-8841` | Deccan | 800 reported back |
| Goods receipt `GRN-2194` | Our warehouse | 780 counted |
| Inspection `QI-318` | Our quality desk | 740 accepted, 40 rejected |
| Invoice `DHT/25-26/5520` | Deccan | 800 billed |

The gaps, which the screen does not “fix”:

- 200 sent and not yet reported back
- 20 reported by the vendor and not counted at the dock
- 40 rejected for low hardness (54–56 HRC against a spec of 58–62)
- 260 short for the customer
- The bill is 60 above the accepted quantity (20 not received, plus 40 rejected)

## What you can do in the prototype

- Read the physical counts, the disagreements, and the 1 Nov risk on **Overview**.
- See vendor message, warehouse count, and inspection as separate sources on **Three sources**.
- Post the inspection, choose rework / return / scrap, raise the shortage claim, hold the invoice, chase the 200, and warn the customer on **Decisions**.
- Watch decision quantities and next actions update. The source counts stay where they were. History records each step.
- On **Vendor import**, load a local JSON fixture. This is labelled as a simulation.

Import behaviour:

- `vendor-dispatch-VDU-8841.json` is a cumulative dispatch total of 800. It is already on the job. Importing it again leaves the figure at 800.
- `vendor-status-VDU-8842.json` is a follow-up note. The first import stores it. The second import is ignored. No quantity changes.
- Tick **Simulate a timeout on the next import**, run an import, and use **Retry import**. A failed attempt writes nothing.

## Research

Two manufacturing products were read for this workflow. Neither site was installed.

**ERPNext** treats subcontracting as its own chain: a service item, a supplier warehouse, a subcontracting order, a stock entry that sends material out, a subcontracting receipt that brings finished goods back, a quality inspection, and a purchase invoice. The [subcontracting manual](https://docs.frappe.io/erpnext/subcontracting) tells the user to receive into an accepted warehouse and to check the quantity consumed at the supplier. Quality inspection is a separate document that can be created from a draft receipt ([quality inspection](https://docs.frappe.io/erpnext/quality-inspection)). A purchase order can be received in more than one purchase receipt ([purchase receipt](https://docs.frappe.io/erpnext/purchase-receipt)). Version 16 can also split one purchase order into more than one subcontracting order so the remainder stays open.

**Odoo 19** resupply subcontracting creates a component transfer out and a receipt back in from the subcontractor purchase order. The [resupply manual](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/subcontracting/subcontracting_resupply.html) shows those as separate inventory steps. Quality checks are again their own action on the receipt ([quality checks](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/quality/quality_management/quality_checks.html)).

What that changed here:

- Sent, vendor-reported, received, accepted, rejected, and billed stay on their own documents. One column cannot edit another.
- The 200 not yet reported stay open. They are not cancelled to force a match.
- Inspection is posted by our quality desk, not copied from the vendor file.
- What neither manual provides is the desk itself: one place that shows the clash, plus an inbound vendor message that is stored by id so the same file cannot be counted twice. A dispatch message is treated as the vendor’s cumulative total, not as a carton to add.

Not checked on a live site: a partial subcontracting receipt in ERPNext, the backorder prompt on an Odoo subcontracting receipt, and whether Odoo’s quality tools for this flow need the paid edition. The plan therefore recommends ERPNext, which is open source, and flags those gaps in [docs/INTEGRATION_PLAN.md](docs/INTEGRATION_PLAN.md).

## Assumptions

- One knuckle needs one heat-treatment cycle. No extra loss is planned.
- We pay for pieces we accepted (740). Deccan’s invoice stays at 800. Holding payment is our decision. It does not rewrite their bill.
- Low hardness is the vendor’s process. The 40 rejects are not payable until a later receipt is accepted. That later receipt is outside this prototype.
- There is no other finished stock of this part.
- The vendor has no API. A JSON file stands in for a portal message.
- 30 Oct 2026 stays the scenario day even if the prototype is opened later, so the shipment remains two days away.

## Walkthrough script (about three minutes)

Record this yourself. The prototype does not include a video.

1. **0:00** Overview. Point at 1,000 ordered, 1,000 sent, 800 reported, 780 counted, 740 accepted, 40 rejected, and the invoice at 800. Say the customer is short by 260, with no other stock, and the ship date is 1 Nov.
2. **0:40** Three sources. Say the vendor message, the warehouse count, and the inspection are different documents.
3. **1:10** Vendor import. Show the simulation banner. Tick the timeout, import dispatch `VDU-8841`, and show that 800 did not change. Retry. The repeat is ignored, so it does not become 1,600. Import status `VDU-8842`, then import it again. The furnace note appears once. Quantities stay put.
4. **2:05** Decisions. Post the inspection, send the 40 for rework, raise the claim for 20, hold the invoice, chase the 200, and warn Bharat Axle. Go back to Overview: decision quantities changed, the shortfall is still 260. Open History.
5. **2:35** Integration. Say the grown-up system should be ERPNext, the disagreement desk and the message inbox should be built on top of it, vendor files come before any paid portal, and GST e-invoice waits until the turnover test and portal login are confirmed. The table is in `docs/INTEGRATION_PLAN.md`.

## Limits and unfinished work

- One job, one browser, no login, no accounts posting, no GST filing.
- The vendor portal, the timeout, and the retry are fixtures.
- ERPNext was not installed. No sandbox login was made for GST, e-way bill, or a vendor.
- The three-minute recording is not in this folder. Use the script above.
- Fill in your own times below before you submit. Do not invent them.

## AI tools

Built in Cursor with Grok. The import was corrected so a vendor file **sets** the reported total and remembers the message id. Adding the quantity on every import would have turned 800 into 1,600 and hidden the gap this assignment says to keep. The same correction is what `npm test` locks in.

## Time spent

Replace these with the hours you actually used. Stop at five hours, including this file and the recording.

- Task 1, prototype:
- Task 2, integration plan:
- Documentation and recording:
