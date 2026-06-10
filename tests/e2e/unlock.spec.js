// US2: completing a level unlocks subsequent levels in the overworld. (T039)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("clearing level-a unlocks dependent levels", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => window.TrainSetGo.goOverworld());
  await expect(page.getByTestId("level-level-b")).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("level-level-a-special")).toHaveAttribute("data-locked", "true");

  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.tapHex(0, 0);
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("status")).toContainText("Cleared");

  await page.evaluate(() => window.TrainSetGo.goOverworld());
  await expect(page.getByTestId("level-level-b")).toHaveAttribute("data-locked", "false");
  await expect(page.getByTestId("level-level-a-special")).toHaveAttribute("data-locked", "false");
});
