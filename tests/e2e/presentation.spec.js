// US6: presentation — rendering, camera zoom/pan, and audio feedback. (T068)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("canvas renders and zoom changes the camera", async ({ page }) => {
  await openApp(page);

  const canvas = page.locator("#scene");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);

  await page.evaluate(() => window.TrainSetGo.playLevel("level-a"));

  const before = await page.evaluate(() => window.TrainSetGo.camera().zoom);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  const after = await page.evaluate(() => window.TrainSetGo.camera().zoom);
  expect(after).not.toBe(before);
});

test("running a level emits an audio event", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.TrainSetGo.playLevel("level-a");
    window.TrainSetGo.tapHex(0, 0);
    window.TrainSetGo.runLevel();
  });
  const evt = await page.evaluate(() => window.TrainSetGo.lastAudioEvent());
  expect(evt).not.toBeNull();
  expect(typeof evt.type).toBe("string");
});
