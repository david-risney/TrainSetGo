// US5: author a level in the editor and play it. (T060)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("create a minimal level in the editor, play it, and clear it", async ({ page }) => {
  await openApp(page);

  await page.getByTestId("btn-editor").click();
  await expect(page.getByTestId("screen-editor")).toBeVisible();

  await page.getByTestId("btn-editor-minimal").click();
  await page.getByTestId("btn-editor-play").click();

  await expect(page.getByTestId("screen-game")).toBeVisible();

  // The minimal template leaves a single grass gap at (0,0); fill it and run.
  await page.evaluate(() => window.TrainSetGo.tapHex(0, 0));
  await page.evaluate(() => window.TrainSetGo.runLevel());

  await expect(page.getByTestId("status")).toContainText("Cleared");
});

test("invalid JSON shows an editor error and does not start a game", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("btn-editor").click();
  await page.getByTestId("editor-json").fill("{ not valid json");
  await page.getByTestId("btn-editor-play").click();
  await expect(page.getByTestId("editor-error")).toContainText("Invalid JSON");
  await expect(page.getByTestId("screen-editor")).toBeVisible();
});
