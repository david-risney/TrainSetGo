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

test("two-finger gesture rotates the camera", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.TrainSetGo.playLevel("level-a"));
  const before = await page.evaluate(() => window.TrainSetGo.camera().rotation);

  await page.evaluate(() => {
    const c = document.getElementById("scene");
    const rect = c.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ev = (id, x, y, type) =>
      c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    ev(1, cx - 60, cy, "pointerdown");
    ev(2, cx + 60, cy, "pointerdown");
    // Rotate the two contact points ~90° around the center.
    ev(1, cx, cy - 60, "pointermove");
    ev(2, cx, cy + 60, "pointermove");
    ev(1, cx, cy - 60, "pointerup");
    ev(2, cx, cy + 60, "pointerup");
  });

  const after = await page.evaluate(() => window.TrainSetGo.camera().rotation);
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

test("Creative Commons audio assets load from files", async ({ page }) => {
  await openApp(page);
  const info = await page.evaluate(() => ({
    sfxCount: window.TrainSetGo.app.audio.sfxBuffers.size,
    hasMusic: !!window.TrainSetGo.app.audio.musicEl,
    attribution: window.TrainSetGo.app.audio.attribution(),
  }));
  expect(info.sfxCount).toBeGreaterThan(0);
  expect(info.hasMusic).toBe(true);
  expect(info.attribution).toContain("Kevin MacLeod");
});
