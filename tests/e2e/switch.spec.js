// US4: switch toggling changes train routing and run outcome. (T054)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("default switch state routes the train to the correct station (cleared)", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.TrainSetGo.playLevel("level-switch"));
  await page.evaluate(() => window.TrainSetGo.runLevel());
  await expect(page.getByTestId("status")).toContainText("Cleared");
});

test("toggling the switch routes the train to the wrong station (failed)", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-switch");
    window.TrainSetGo.currentModel().toggleSwitch({ q: 0, r: 0 });
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("status")).toContainText("Failed");
});
