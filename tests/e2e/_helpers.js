import { expect } from "@playwright/test";

// Navigate to the app with a clean save, and wait for the test API to be ready.
// Storage is cleared once at startup (not via an init script), so tests can reload
// the page to verify persistence.
export async function openApp(page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.TrainSetGo);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.TrainSetGo);
  await expect(page.getByTestId("screen-overworld")).toBeVisible();
}

export async function getState(page) {
  return page.evaluate(() => window.TrainSetGo.currentModel()?.getState() ?? null);
}
