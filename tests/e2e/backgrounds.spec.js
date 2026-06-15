// Backgrounds: the overworld uses the persisted menu background; each level uses the
// background named in its data; the settings selector changes + persists the menu choice.
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("overworld uses the default menu background; a level uses its own", async ({ page }) => {
  await openApp(page);
  expect(await page.evaluate(() => window.TrainSetGo.background())).toBe("sunny-rails");

  await page.getByTestId("level-level-a").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();
  expect(await page.evaluate(() => window.TrainSetGo.background())).toBe("plasma");
});

test("the settings selector changes and persists the menu background", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.TrainSetGo.goSettings());

  await page.getByTestId("menu-background").selectOption("kaleido");
  // Settings is itself a menu screen, so the change applies live.
  expect(await page.evaluate(() => window.TrainSetGo.background())).toBe("kaleido");

  await page.reload();
  await page.waitForFunction(() => !!window.TrainSetGo);
  expect(await page.evaluate(() => window.TrainSetGo.state().settings.menuBackground)).toBe("kaleido");
  // The reloaded overworld picks up the persisted menu background.
  expect(await page.evaluate(() => window.TrainSetGo.background())).toBe("kaleido");
});
