// US6: settings persist across reloads. (T069)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("muting sound effects persists across a reload", async ({ page }) => {
  await openApp(page);

  await page.getByTestId("btn-settings").click();
  await expect(page.getByTestId("screen-settings")).toBeVisible();

  await page.getByTestId("sfx-mute").check();
  await expect(page.getByTestId("sfx-mute")).toBeChecked();

  // Adjust a volume slider too and confirm it is reflected in persisted state.
  await page.getByTestId("music-volume").evaluate((el) => {
    el.value = "0.25";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.reload();
  await page.waitForFunction(() => !!window.TrainSetGo);

  const settings = await page.evaluate(() => window.TrainSetGo.state().settings);
  expect(settings.sfxMuted).toBe(true);
  expect(settings.musicVolume).toBeCloseTo(0.25, 5);

  await page.evaluate(() => window.TrainSetGo.goSettings());
  await expect(page.getByTestId("sfx-mute")).toBeChecked();
});
