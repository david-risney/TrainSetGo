// US2: an end-of-level summary modal reports the result, unlocks, and next actions.
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("clearing a level shows a summary with unlocks, retry, menu, and next", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.tapHex(0, 0);
    window.TrainSetGo.tapHex(0, 2);
    window.TrainSetGo.tapHex(0, -2);
    window.TrainSetGo.runLevel();
  });

  const summary = page.getByTestId("screen-summary");
  await expect(summary).toBeVisible();
  await expect(page.getByTestId("summary-title")).toContainText("Cleared");
  await expect(summary).toContainText("100% delivered");
  await expect(summary).toContainText("Unlocked");
  await expect(page.getByTestId("btn-summary-retry")).toBeVisible();
  await expect(page.getByTestId("btn-summary-menu")).toBeVisible();
  await expect(page.getByTestId("btn-summary-next")).toBeVisible();
});

test("next level button starts the next campaign level", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.tapHex(0, 0);
    window.TrainSetGo.tapHex(0, 2);
    window.TrainSetGo.tapHex(0, -2);
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("screen-summary")).toBeVisible();
  await page.getByTestId("btn-summary-next").click();
  await expect(page.getByTestId("screen-summary")).toBeHidden();
  await expect(page.getByTestId("screen-game")).toBeVisible();
});

test("retry from the summary restarts the same level", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("summary-title")).toContainText("Failed");
  await page.getByTestId("btn-summary-retry").click();
  await expect(page.getByTestId("screen-summary")).toBeHidden();
  await expect(page.getByTestId("screen-game")).toBeVisible();
});

test("menu button returns to the main menu", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("screen-summary")).toBeVisible();
  await page.getByTestId("btn-summary-menu").click();
  await expect(page.getByTestId("screen-menu")).toBeVisible();
});
