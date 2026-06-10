// US3: save/load — unlocks and in-progress placements persist across reloads. (T046)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("unlocked levels persist across a reload", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.tapHex(0, 0);
    window.TrainSetGo.tapHex(0, 2);
    window.TrainSetGo.tapHex(0, -2);
    window.TrainSetGo.runLevel();
  });
  await expect(page.getByTestId("status")).toContainText("Cleared");

  await page.reload();
  await page.waitForFunction(() => !!window.TrainSetGo);

  await page.evaluate(() => window.TrainSetGo.goOverworld());
  await expect(page.getByTestId("level-level-b")).toHaveAttribute("data-locked", "false");
});

test("in-progress placement is restored after a reload", async ({ page }) => {
  await openApp(page);

  // Place a tile but do not run, then reload.
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.tapHex(0, 0);
  });

  await page.reload();
  await page.waitForFunction(() => !!window.TrainSetGo);

  // Menu shows "Continue" and resumes the in-progress level.
  await expect(page.getByTestId("btn-start")).toHaveText("Continue");
  await page.getByTestId("btn-start").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();

  const placed = await page.evaluate(() => {
    const tiles = window.TrainSetGo.currentModel().getState().tiles;
    return tiles.some((t) => t.q === 0 && t.r === 0 && t.track && t.playerPlaced);
  });
  expect(placed).toBe(true);
});
