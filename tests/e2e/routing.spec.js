// Client-side routing: each view has its own URL and back/forward + deep-links work.
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

const pathOf = (page) => new URL(page.url()).pathname;

test("navigating between views updates the URL", async ({ page }) => {
  await openApp(page);
  expect(pathOf(page)).toBe("/");

  await page.getByTestId("btn-start").click();
  await expect(page.getByTestId("screen-overworld")).toBeVisible();
  expect(pathOf(page)).toBe("/overworld");

  await page.getByTestId("level-level-a").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();
  expect(pathOf(page)).toBe("/stage/level-a");
});

test("editor and settings have their own URLs", async ({ page }) => {
  await openApp(page);

  await page.getByTestId("btn-editor").click();
  await expect(page.getByTestId("screen-editor")).toBeVisible();
  expect(pathOf(page)).toBe("/editor");

  await page.goBack();
  await expect(page.getByTestId("screen-menu")).toBeVisible();
  expect(pathOf(page)).toBe("/");

  await page.getByTestId("btn-settings").click();
  await expect(page.getByTestId("screen-settings")).toBeVisible();
  expect(pathOf(page)).toBe("/settings");
});

test("browser back/forward replays the matching screen", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => window.TrainSetGo.goOverworld());
  await expect(page.getByTestId("screen-overworld")).toBeVisible();
  await page.evaluate(() => window.TrainSetGo.playLevel("level-a"));
  await expect(page.getByTestId("screen-game")).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId("screen-overworld")).toBeVisible();
  expect(pathOf(page)).toBe("/overworld");

  await page.goForward();
  await expect(page.getByTestId("screen-game")).toBeVisible();
  expect(pathOf(page)).toBe("/stage/level-a");
});

test("deep-linking directly to a view renders it (SPA fallback)", async ({ page }) => {
  // Reset save on a clean root load first, then hard-navigate to a deep route.
  await page.goto("/");
  await page.waitForFunction(() => !!window.TrainSetGo);
  await page.evaluate(() => window.localStorage.clear());

  await page.goto("/overworld");
  await page.waitForFunction(() => !!window.TrainSetGo);
  await expect(page.getByTestId("screen-overworld")).toBeVisible();

  await page.goto("/stage/level-a");
  await page.waitForFunction(() => !!window.TrainSetGo);
  await expect(page.getByTestId("screen-game")).toBeVisible();
});
