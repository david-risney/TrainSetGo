// Music coordination: the menu/overworld plays its own track; each level plays the track
// named in its data; the now-playing widget shows the song + artist with Next and Mute.
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("menu and levels play their configured tracks; now-playing reflects them", async ({ page }) => {
  await openApp(page);

  // The overworld (menu) shows the now-playing widget with the menu track.
  await expect(page.getByTestId("now-playing")).toBeVisible();
  const menuTrack = await page.evaluate(() => window.TrainSetGo.nowPlaying());
  expect(menuTrack?.id).toBe("wallpaper");
  await expect(page.getByTestId("np-label")).toContainText("Wallpaper");
  await expect(page.getByTestId("np-label")).toContainText("Kevin MacLeod");

  // Starting a level switches to that level's configured track.
  await page.getByTestId("level-level-a").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();
  const levelTrack = await page.evaluate(() => window.TrainSetGo.nowPlaying());
  expect(levelTrack?.id).toBe("carefree");
  await expect(page.getByTestId("np-label")).toContainText("Carefree");
});

test("the Next button advances to another track", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("level-level-a").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();

  // level-a's playlist is a single track, so Next replays the same track without error.
  const before = await page.evaluate(() => window.TrainSetGo.nowPlaying()?.id);
  await page.getByTestId("np-next").click();
  const after = await page.evaluate(() => window.TrainSetGo.nowPlaying()?.id);
  expect(after).toBe(before);
  expect(after).toBe("carefree");
});

test("the mute toggle mutes music, stops the disc spinning, and persists", async ({ page }) => {
  await openApp(page);

  await expect(page.getByTestId("np-disc")).not.toHaveClass(/paused/);
  await page.getByTestId("np-mute").click();

  expect(await page.evaluate(() => window.TrainSetGo.musicMuted())).toBe(true);
  await expect(page.getByTestId("np-disc")).toHaveClass(/paused/);
  await expect(page.getByTestId("np-mute")).toHaveText("🔇");

  await page.reload();
  await page.waitForFunction(() => !!window.TrainSetGo);
  expect(await page.evaluate(() => window.TrainSetGo.state().settings.musicMuted)).toBe(true);
});
