// Client-side routing: each view has its own URL and back/forward + deep-links work.
// The overworld is the home screen ("/"); the editor lives at its own /editor URL.
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

const pathOf = (page) => new URL(page.url()).pathname;

test("the home screen is the overworld and starting a level updates the URL", async ({ page }) => {
  await openApp(page);
  expect(pathOf(page)).toBe("/");
  await expect(page.getByTestId("screen-overworld")).toBeVisible();

  await page.getByTestId("level-level-a").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();
  expect(pathOf(page)).toBe("/stage/level-a");
});

test("editor and settings have their own URLs", async ({ page }) => {
  await openApp(page);

  // The editor has no node on the overworld; it is reached by its own URL/hook.
  await page.evaluate(() => window.TrainSetGo.goEditor());
  await expect(page.getByTestId("screen-editor")).toBeVisible();
  expect(pathOf(page)).toBe("/editor");

  await page.goBack();
  await expect(page.getByTestId("screen-overworld")).toBeVisible();
  expect(pathOf(page)).toBe("/");

  // Settings is its own station on the overworld.
  await page.getByTestId("btn-settings").click();
  await expect(page.getByTestId("screen-settings")).toBeVisible();
  expect(pathOf(page)).toBe("/settings");
});

test("browser back/forward replays the matching screen", async ({ page }) => {
  await openApp(page);

  await expect(page.getByTestId("screen-overworld")).toBeVisible();
  await page.evaluate(() => window.TrainSetGo.playLevel("level-a"));
  await expect(page.getByTestId("screen-game")).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId("screen-overworld")).toBeVisible();
  expect(pathOf(page)).toBe("/");

  await page.goForward();
  await expect(page.getByTestId("screen-game")).toBeVisible();
  expect(pathOf(page)).toBe("/stage/level-a");
});

test("deep-linking directly to a view renders it (SPA fallback)", async ({ page }) => {
  // Reset save on a clean root load first, then hard-navigate to a deep route.
  await page.goto("/");
  await page.waitForFunction(() => !!window.TrainSetGo);
  await page.evaluate(() => window.localStorage.clear());

  // The editor is independently reachable by URL even though it has no overworld node.
  await page.goto("/editor");
  await page.waitForFunction(() => !!window.TrainSetGo);
  await expect(page.getByTestId("screen-editor")).toBeVisible();

  await page.goto("/stage/level-a");
  await page.waitForFunction(() => !!window.TrainSetGo);
  await expect(page.getByTestId("screen-game")).toBeVisible();
});
