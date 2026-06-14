// US1: place track for the trains and clear level-a (arcade: trains auto-run). (T029)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("bridging every corridor delivers all trains and clears level-a", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    // Fill the single editable gap in each of the three corridors.
    window.TrainSetGo.tapHex(0, 0);
    window.TrainSetGo.tapHex(0, 2);
    window.TrainSetGo.tapHex(0, -2);
    window.TrainSetGo.runLevel(); // deterministic fast-forward
  });

  await expect(page.getByTestId("status")).toContainText("Cleared");
  await expect(page.getByTestId("status")).toContainText("100%");
});

test("leaving corridors unbridged loses trains and fails the level", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("status")).toContainText("Failed");
});
