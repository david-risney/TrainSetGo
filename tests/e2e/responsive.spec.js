// Responsive / mobile: layout fits small viewports and touch input works. (T077)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("layout fits a mobile viewport without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openApp(page);

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  // Canvas fills the viewport width.
  const box = await page.locator("#scene").boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(370);

  // Primary buttons meet the 44px touch-target minimum.
  const btnHeight = await page.getByTestId("btn-start").evaluate((el) => el.getBoundingClientRect().height);
  expect(btnHeight).toBeGreaterThanOrEqual(44);
});

test("tap input places a tile on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openApp(page);
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.tapHex(0, 0);
    window.TrainSetGo.tapHex(0, 2);
    window.TrainSetGo.tapHex(0, -2);
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("status")).toContainText("Cleared");
});
