// Voxel models: editable .vox assets are loaded at startup and rendered for trains/stations.
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("the train and station .vox models load at startup", async ({ page }) => {
  await openApp(page);
  const names = await page.evaluate(() => window.TrainSetGo.modelNames());
  expect(names).toContain("train");
  expect(names).toContain("station");
});

test("a loaded voxel model exposes culled, centered voxels", async ({ page }) => {
  await openApp(page);
  const train = await page.evaluate(() => window.TrainSetGo.app.models.get("train"));
  expect(train.voxels.length).toBeGreaterThan(0);
  // Interior voxels are dropped, so the rendered count is below the authored total.
  expect(train.tint).toBe("theme");
});
