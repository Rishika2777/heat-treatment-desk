import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.WALKTHROUGH_URL ?? "http://127.0.0.1:5173/";
const rawDir = path.resolve("docs/walkthrough-raw");
const finalPath = path.resolve("docs/walkthrough.webm");

await mkdir(rawDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: rawDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();

async function caption(text) {
  await page.evaluate((message) => {
    let bar = document.getElementById("walkthrough-caption");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "walkthrough-caption";
      bar.style.cssText = [
        "position:fixed",
        "left:264px",
        "right:20px",
        "bottom:16px",
        "z-index:9999",
        "background:#1b2430",
        "color:#fff",
        "padding:12px 16px",
        "border-radius:12px",
        "font:600 18px/1.4 Segoe UI,sans-serif",
        "box-shadow:0 8px 24px rgba(0,0,0,.25)",
      ].join(";");
      document.body.appendChild(bar);
    }
    bar.textContent = message;
  }, text);
}

function pause(ms) {
  return page.waitForTimeout(ms);
}

async function show(name) {
  await page.getByRole("button", { name, exact: true }).click();
  await pause(400);
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await caption("Job JW-1048. Bharat Axle needs 1,000 finished parts on 1 Nov. No other stock.");
await pause(7000);

await page.getByRole("heading", { name: /Short by 260/ }).scrollIntoViewIfNeeded();
await caption("Only 740 passed quality, so the shipment is short by 260.");
await pause(7000);

await page.getByRole("heading", { name: "Follow the pieces" }).scrollIntoViewIfNeeded();
await caption("1,000 were sent. The vendor reports 800. The warehouse counted 780. Quality accepted 740.");
await pause(8000);

await page.getByRole("heading", { name: "What does not match" }).scrollIntoViewIfNeeded();
await caption("200 are still out. 20 are missing at the dock. 40 failed inspection. The bill is for 800.");
await pause(8000);

await show("Three sources");
await caption("These are three different records: the vendor message, the warehouse count, and quality.");
await pause(5000);
await page.getByText("Vendor", { exact: true }).first().scrollIntoViewIfNeeded();
await pause(7000);

await show("Vendor import");
await caption("Simulation. This reads a file on this computer. It is not a live vendor portal.");
await pause(6000);
const timeoutBox = page.getByRole("checkbox", { name: /Simulate a timeout/ });
await timeoutBox.scrollIntoViewIfNeeded();
await timeoutBox.check();
await page.getByRole("button", { name: "Import dispatch VDU-8841" }).click();
await caption("Simulated timeout. Nothing was written. Vendor-reported dispatch stays 800.");
await pause(7000);
await page.getByRole("button", { name: "Retry import" }).click();
await caption("Retry succeeded. The same dispatch was already stored, so 800 was not added again.");
await pause(8000);
await page.getByRole("button", { name: "Import status VDU-8842" }).click();
await caption("The status note is stored once. It does not change any quantity.");
await pause(7000);
await page.getByRole("button", { name: "Import status VDU-8842" }).click();
await caption("Importing that same note again is ignored.");
await pause(7000);

await page.getByRole("button", { name: /^Decisions/ }).click();
await pause(400);
await caption("Each action files a decision. The source counts stay 800, 780, 740, and 40.");
await pause(4000);
for (const label of [
  "Post inspection QI-318",
  "Send the 40 rejects back for rework",
  "Raise shortage claim for 20",
  "Hold the invoice",
  "Chase the 200 still out",
  "Warn Bharat Axle",
]) {
  const button = page.getByRole("button", { name: label, exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await pause(2500);
}
await caption("Inspection posted, rejects sent for rework, claim raised, invoice held, vendor chased, customer warned.");
await pause(6000);

await show("Overview");
await page.getByTestId("next-actions").scrollIntoViewIfNeeded();
await caption("Follow-up is filed. The shipment is still short by 260. The disagreement was not erased.");
await pause(8000);

await show("History");
await caption("History keeps the opening counts and every decision, newest first.");
await pause(8000);

await show("About");
await page.getByRole("heading", { name: "What shaped the screen" }).scrollIntoViewIfNeeded();
await caption("For a real system, use ERPNext. Build this desk and the message inbox on top of it.");
await pause(8000);
await caption("Start with vendor files, not a paid portal. GST e-invoice waits until login and turnover are confirmed.");
await pause(8000);
await caption("The full integration table is in docs/INTEGRATION_PLAN.md. This walkthrough has no audio.");
await pause(6000);

await context.close();
await browser.close();

const recorded = await video.path();
await rename(recorded, finalPath);
console.log(finalPath);
