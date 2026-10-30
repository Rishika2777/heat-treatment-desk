# Integration plan

How this prototype would grow into a manufacturing ERP for Shakti Auto Components. The company is a small auto-parts plant. The first real workflow is job-work heat treatment: material goes out, a vendor message comes back, the dock count and the inspection can disagree, and the vendor bill must not be paid as if they matched.

Team assumed below: **two people**. One builds the system. One knows stores, purchase, and quality and checks the screens against a real challan. Nobody has production GST credentials, a vendor API, or a paid integration account on day one.

## Build these inside the ERP

Do not buy a separate product for the core of this job.

- The quantity ledger: sent, vendor-reported, received, accepted, rejected, billed.
- The disagreement desk and the next-action list from the prototype.
- The inbound message log, with a unique message id so a file cannot be applied twice.
- Inspection posting and the rework / return / scrap decision.
- The sales order, the promise date, and the “no other finished stock” check.
- Bill of materials and the supplier warehouse for pieces sitting at Deccan.

Buy or connect the things that are someone else’s legal or physical system: GST portal, bank, email, and the scanner hardware.

## Integration table

Need is **Essential**, **Optional**, or **Not applicable** for this plant in the first month. “Unverified” means it was not proven in a live account for this assignment.

| Area | Need | Recommended approach | Fastest practical implementation | Failure and fallback |
|---|---|---|---|---|
| Books they already run, stock, purchasing, and moving old data | Essential if a ledger already exists. Confirm whether that ledger is Tally or something else. Unverified for this company. | Keep one stock ledger. Prefer ERPNext for stock, purchase, and subcontracting rather than a second inventory tool. Official pattern: [ERPNext subcontracting](https://docs.frappe.io/erpnext/subcontracting). | Install ERPNext locally. Create the item, supplier warehouse, subcontracting order, send-out entry, receipt of 780, and invoice of 800 without editing them to match. If Tally must stay for a while, export a purchase voucher file once a day. Confirm the file layout against the Tally release they actually use. | If the old ledger and ERPNext disagree, the dock count in ERPNext wins for stock, and the accountant’s ledger wins for money already filed. Do not auto-overwrite either. Pause the sync and show both figures, the same way this prototype keeps 800 and 780. |
| Customers, orders, portals, EDI, forecasts | Sales orders are essential. A CRM, a customer portal, EDI, and statistical forecasts are not applicable until a customer contract requires them. Bharat Axle’s portal or EDI requirement is unverified. | Sales orders live in the ERP. Delivery risk is the desk already prototyped, not a CRM. | Enter `BAS-PO-2291` as a sales order with the 1 Nov date. Send the shortage warning by email. | If the customer’s portal is down, the order still ships from our sales order. Store the portal’s file if they send one, and do not let it replace our accepted quantity. |
| Suppliers, job work, dispatches, invoices | Essential. This is the prototype. | Build the message inbox on ERPNext documents. Do not wait for a vendor portal product. Deccan’s ability to call a webhook is unverified; assume they cannot. | Subcontracting order for 1,000, stock entry for the challan, subcontracting receipt for 780, purchase invoice left at 800 and held. Inbound JSON or spreadsheet is saved as a Vendor Message with a unique `message_id`. Same id on a second file is rejected. A dispatch file sets the cumulative reported total. It is not added. | Portal or mailbox down: stores still post the receipt they counted. Duplicate file: unique id stops a second apply. Vendor total conflicts with the receipt: keep both and raise the claim. No API: keep using the file. |
| Drawings, BOM, revisions | BOM is essential. A CAD or PLM system is optional and not applicable in month one. | BOM and revision live on the item (`SAC-KN-4418` Rev C). Drawings are PDF attachments. | One BOM: one unprocessed knuckle becomes one heat-treated knuckle. Attach the PDF. | If the drawing file is missing, block the job from release. Do not guess the revision. |
| Shop floor and scheduling | A simple operation step is essential. A separate MES is not applicable at this size. | The heat-treatment step is subcontracted, so it is a subcontracting order, not a second factory system. In-house steps, if any, stay on ERPNext job cards. | One subcontracting order per challan. Due date comes from the sales order. | If scheduling is wrong, the desk still shows the real receipt and the real ship date. The promise date is not moved just because the vendor message is late. |
| Machines, downtime, maintenance, IoT | Not applicable in the first month. A breakdown notebook can be a custom doctype later. Optional after that. | Do not connect machine sensors yet. Whether any furnace at Shakti even exposes data is unverified. | Skip. | No machine feed means people still type downtime. Absence of IoT must not block goods receipt. |
| Warehouse, scanners, weighing, transporters, tracking | Receipt and dispatch are essential. A separate WMS, RFID, and scale integration are not applicable. | USB barcode scanners that type into the receipt screen. No scanner SDK. Transporter name and LR number are fields on the delivery. Tracking links are optional. | Keyboard-wedge scanner into `GRN-2194`. Count stays a typed, confirmed quantity even if a barcode was scanned. | Scanner dead: type the quantity. Transporter site down: store the LR number and check later. Never replace a physical count with a scan that failed halfway. |
| Quality, lab results, certificates, traceability | Essential, and it belongs in the ERP. An outside LIMS is not applicable. | Quality inspection document linked to the receipt, as in [ERPNext quality inspection](https://docs.frappe.io/erpnext/quality-inspection). Heat-treatment certificate is a PDF on the inspection. | Inspection required before the 740 can be reserved for the customer. Rejected 40 go to a reject location, not to finished goods. | If the certificate PDF is late, the pieces stay in quality hold. A vendor’s own “passed” line on a portal message cannot post our inspection. |
| Bank payments and matching the bill | Essential. A payment API is optional and not part of month one. | The match of bill, receipt, and accepted quantity is a check we build. Paying the vendor is a bank file or the bank’s own site. Automatic three-way match that includes accepted quantity was not found as a single switch in the ERPNext or Odoo manuals read for this assignment. Treat it as something we add. | Hold `DHT/25-26/5520` in the ERP. Accountant pays 740 worth from the bank and records the payment number afterwards. | Bank site down: do not mark the bill paid. Duplicate payment file: the payment number is unique. If the bank amount differs from 740, leave the bill open and show both amounts. |
| GST, e-invoice, e-way bill | Essential when the law says so. Not a blanket “turn it on”. | E-invoice is mandatory for a registered person whose aggregate turnover exceeds ₹5 crore in any financial year from 2017-18, from 1 Aug 2023 ([Notification 10/2023](https://tutorial.gst.gov.in/einvoice/files/Notification_No._10_2023.pdf), [e-invoice portal](https://einvoice.gst.gov.in/), [FAQs](https://einvoice.gst.gov.in/faqs)). Shakti’s turnover was not provided. If they are under the line, e-invoice is not applicable. E-way bill is a separate question for the challan and the return trip. Confirm the current threshold for that movement on [ewaybillgst.gov.in](https://ewaybillgst.gov.in/). The Maharashtra intra-state limit was not re-checked in a login for this assignment. | Week one: no portal login. Print the delivery challan from ERPNext. When credentials exist, use ERPNext’s India entries plus a GSP or a Frappe compliance app. The exact sandbox steps of any compliance app were not run here. Confirm them on that app’s own docs before go-live. A later change for some reverse-charge self-invoices has been reported for 1 Jan 2027. The gazette text was not read for this assignment, so confirm it on the GST portal before planning any work. It is outside this build anyway. | Portal down: do not invent an IRN. Hold the tax invoice and use the government offline path if one is published for that outage. Duplicate IRN: store the IRN against the invoice id. If the portal rejects the payload, the stock receipt still stands; tax filing is a separate queue. |
| People, payroll, attendance, SSO | Login for the two users is essential. Payroll, attendance, and SSO are optional and not part of this workflow. | Named users in ERPNext. Roles: stores, quality, purchase, production. Google login can wait. | Two user accounts and four roles. The production manager can post decisions. Stores can post the receipt. Quality can post inspection. Purchase can hold the bill. | If SSO fails later, password login remains. Do not block the receipt screen on an identity provider. |
| Email, WhatsApp, files, OCR, e-sign | Email is essential. WhatsApp, OCR, and e-sign are optional. | Company mailbox. Claim and customer warning are emails sent from the decision, with the text stored on the job. WhatsApp Cloud API is a later option ([Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)); do not make the workflow depend on it. | ERPNext email, or the person copies the claim text into their mailbox if email setup is still waiting. Attach the invoice PDF. OCR of that PDF is a later convenience, not the source of the 800. The typed bill quantity is the source. | Mail server down: the decision is already saved. Send the email when mail returns. The same decision id must not send a second email after a retry. OCR misread: a person confirms the quantity before it becomes the billed figure. |
| BI, warehouse of data, exports | A CSV for the accountant is essential. A BI tool or a data warehouse is not applicable in month one. Optional later: Metabase on a read-only copy ([Metabase docs](https://www.metabase.com/docs/latest/)). | The desk is the report. Export the job row when someone asks. | One list view and a CSV: job, sent, vendor-reported, received, accepted, rejected, billed, ship date, open actions. | If a future BI database is stale, people open the ERP. The ERP remains the place a quantity can be changed. |

Odoo was the second product researched ([resupply subcontracting](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/subcontracting/subcontracting_resupply.html), [quality checks](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/quality/quality_management/quality_checks.html)). It separates the component issue, the receipt, and quality checks in the same spirit. It is not the system recommended here: which of those quality pieces need a paid Odoo edition was not verified, and the assignment does not need a paid licence. ERPNext covers the documents without one.

## Action plan

**Framework and tools.** This prototype stays Vite, React, and TypeScript, with browser storage and JSON fixtures. The system to grow is ERPNext on Frappe. Integration tools are ERPNext documents, a unique-id inbox, email, and later the GST portal. No paid connector is required to start.

**What speeds it up.** ERPNext subcontracting, stock, quality inspection, and purchase invoice. A USB scanner that needs no driver work. The government e-invoice and e-way bill portals once a login exists. A compliance app only after its current docs are checked in a sandbox.

**Reuse.** Stock ledger, subcontracting order, receipt, quality inspection, purchase invoice, sales order, attachments, users and roles, CSV.

**Build.** The disagreement desk, the next-action list, the vendor-message inbox and its duplicate rule, the hold on a bill whose quantity is above the accepted quantity, and the customer-shortage warning. Those are the parts the two manuals do not give as one screen.

**Sequence**

First two days

- Sit with the stores person and confirm the pay rule: pay 740, or pay 780 and argue the 40 later. The prototype assumes 740. Change the rule in words before building it.
- Confirm whether any ledger (often Tally) already exists, and whether any customer demands a portal or EDI. Both are unverified.
- Write the six quantities on paper against challan `DC-HT-7731` so the software words match the shop words.

First week

- ERPNext on a local machine. Item, revision, BOM, supplier warehouse, users.
- Enter this job as real document types without forcing 800, 780, and 740 to match.
- A single desk page that reads those documents and shows the same gaps as this prototype.
- Vendor Message doctype. Unique message id. Import the two JSON fixtures. Second import does nothing.

First month

- Inspection required before pieces can be promised to Bharat Axle.
- Invoice hold when billed quantity is above accepted quantity. Payment still happens in the bank, then the reference is typed back.
- The decision buttons send one email each, and a retry does not send a second one.
- CSV for the accountant.
- E-way bill or e-invoice only if the turnover and the consignment rules say they apply, and only after a sandbox login. Until then, the challan is printed from the ERP and filed the way the company already files it.
- Not in this month: MES, machine sensors, payroll, RFID, a data warehouse, WhatsApp, OCR, customer EDI.

**Access, in the order they actually block work**

- ERPNext can be installed without anyone’s permission.
- Deccan will not be asked to build an API. Files are enough.
- A GST or e-way bill login needs the company’s credentials and may need a GSP approval. That wait is why tax filing is month-one only if the login arrives, and is explicitly unfinished if it does not.
- A customer EDI spec, if it exists, is a later project. It is not assumed.
