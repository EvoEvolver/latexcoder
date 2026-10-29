// Renders marketing/xiaohongshu/cards.html into one PNG per card and the website's Open Graph image.
// Run scripts/capture-marketing.ts (zh-CN and en) first so the screenshots exist.

import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

const source = path.resolve("marketing/xiaohongshu/cards.html");
const outputDir = path.resolve("marketing/xiaohongshu");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 1600 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  for (const card of await page.locator("section.card").all()) {
    const id = await card.getAttribute("id");
    if (!id) continue;
    const file = id === "og" ? path.resolve("site/assets/og.png") : path.join(outputDir, `${id.replace("card-", "")}.png`);
    await card.screenshot({ path: file });
    console.log(file);
  }
} finally {
  await browser.close();
}
