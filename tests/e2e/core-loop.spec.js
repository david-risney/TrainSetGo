// US1: place track, run the simulation, and clear a level. (T029)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("place a track tile, run, and clear level-a", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => window.TrainSetGo.playLevel("level-a"));
  await expect(page.getByTestId("screen-game")).toBeVisible();
  await expect(page.getByTestId("status")).toHaveText("Editing");

  // Fill the gap at (0,0) with a straight track (default tool), then run.
  await page.evaluate(() => window.TrainSetGo.tapHex(0, 0));
  await page.evaluate(() => window.TrainSetGo.runLevel());

  await expect(page.getByTestId("status")).toContainText("Cleared");
  await expect(page.getByTestId("status")).toContainText("100%");
});

test("running without completing the track fails the level", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.TrainSetGo.playLevel("level-a"));
  await page.evaluate(() => window.TrainSetGo.runLevel());
  await expect(page.getByTestId("status")).toContainText("Failed");
  await expect(page.getByTestId("btn-retry")).toBeVisible();
});
