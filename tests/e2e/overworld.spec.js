// US2 regression: clicking a station node in the overworld must start that level.
// Guards the pointer-events wiring (the .screen container is pointer-events:none, so the
// level-node buttons must explicitly re-enable pointer events or real clicks fall through
// to the canvas and nothing happens).
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("clicking an unlocked overworld station starts the level", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => window.TrainSetGo.goOverworld());
  await expect(page.getByTestId("screen-overworld")).toBeVisible();

  // Real user click (not the test hook) on the first unlocked level node.
  const node = page.locator('.level-node[data-locked="false"]').first();
  await expect(node).toBeVisible();
  await node.click();

  await expect(page.getByTestId("screen-game")).toBeVisible();
});

test("clicking a locked overworld station does nothing", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => window.TrainSetGo.goOverworld());
  const locked = page.locator('.level-node[data-locked="true"]').first();
  await expect(locked).toBeVisible();
  await locked.click({ force: true });

  // Still on the overworld; a locked level must not start.
  await expect(page.getByTestId("screen-overworld")).toBeVisible();
});
