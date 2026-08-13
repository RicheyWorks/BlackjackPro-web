import { chromium } from "playwright";

const url = "http://127.0.0.1:8080/";
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function shot(page, name, w = 1280, h = 800) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(url, { waitUntil: "networkidle" });
await shot(page, "start");

await page.getByRole("button", { name: /sit down/i }).click();
await page.waitForTimeout(400);
await shot(page, "seated");

await page.getByRole("button", { name: /^table$/i }).click();
await page.waitForTimeout(200);
const countSwitch = page.getByRole("switch", { name: /hi-lo count/i });
if (await countSwitch.isVisible().catch(() => false)) {
  const on = await countSwitch.getAttribute("aria-checked");
  if (on !== "true") await countSwitch.click();
}
await page.getByRole("button", { name: /close/i }).click();
await page.waitForTimeout(200);

const chips = page.getByRole("button", { name: /25 dollar/i });
const countBet = page.getByRole("button", { name: /count bet/i });
if (await countBet.isVisible().catch(() => false) && await countBet.isEnabled().catch(() => false)) {
  await countBet.click();
} else {
  await chips.click();
}
await page.getByRole("button", { name: /21\+3/i }).click();
await chips.click();
await page.waitForTimeout(200);
await shot(page, "bet");

await page.getByRole("button", { name: /^deal$/i }).click();
await page.waitForTimeout(700);
await shot(page, "dealt");

const hit = page.getByRole("button", { name: /^hit/i });
if (await hit.isVisible().catch(() => false)) {
  if (await hit.isEnabled()) {
    await hit.click();
    await page.waitForTimeout(500);
  }
}
const stand = page.getByRole("button", { name: /^stand/i });
if (await stand.isVisible().catch(() => false) && await stand.isEnabled().catch(() => false)) {
  await stand.click();
  await page.waitForTimeout(700);
}

await page.getByRole("button", { name: /let the coach play/i }).click();
await page.waitForTimeout(2800);
await shot(page, "after-action");

const page2 = await browser.newPage();
await page2.setViewportSize({ width: 390, height: 844 });
await page2.goto(url, { waitUntil: "networkidle" });
await page2.getByRole("button", { name: /sit down/i }).click();
await page2.waitForTimeout(300);
const overflow = await page2.evaluate(() => {
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  };
});
await page2.screenshot({ path: "/workspace/screenshots/mobile.png", fullPage: true });

console.log(JSON.stringify({ errors, overflow, body: (await page.locator("body").innerText()).slice(0, 500) }, null, 2));
await browser.close();
