// US5: author a level in the visual editor (game map view + grouped tile palette) and
// play it. The editor paints tiles onto the normal game map; "Save & Play" compiles the
// painted map into a level definition and plays it. (T060)
import { test, expect } from "@playwright/test";
import { openApp } from "./_helpers.js";

test("paint stations in the visual editor, play, and clear the level", async ({ page }) => {
  await openApp(page);

  await page.getByTestId("btn-editor").click();
  await expect(page.getByTestId("screen-editor")).toBeVisible();

  // The palette shows grouped tile pickers (track / stations / terrain).
  await expect(page.getByTestId("editor-palette")).toBeVisible();
  await expect(page.getByTestId("tool-track-straight")).toBeVisible();
  await expect(page.getByTestId("tool-station-green")).toBeVisible();
  await expect(page.getByTestId("tool-terrain-grass")).toBeVisible();

  // Paint two green stations with a one-tile grass gap between them.
  await page.evaluate(() => {
    window.TrainSetGo.editorSelectTool("station", "green");
    window.TrainSetGo.editorTapHex(-1, 0);
    window.TrainSetGo.editorTapHex(1, 0);
  });

  await page.getByTestId("btn-editor-play").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();

  // Fill the editable grass gap at (0,0) and run.
  await page.evaluate(() => window.TrainSetGo.tapHex(0, 0));
  await page.evaluate(() => window.TrainSetGo.runLevel());

  await expect(page.getByTestId("status")).toContainText("Cleared");
});

test("playing with fewer than two stations shows an error and stays in the editor", async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId("btn-editor").click();

  await page.getByTestId("btn-editor-play").click();
  await expect(page.getByTestId("editor-error")).toContainText("at least two stations");
  await expect(page.getByTestId("screen-editor")).toBeVisible();
});

test("track tiles re-tap to rotate the placed piece", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("btn-editor").click();

  const orientation = await page.evaluate(() => {
    const ed = window.TrainSetGo.app.currentScreen;
    window.TrainSetGo.editorSelectTool("track", "slightCurve");
    window.TrainSetGo.editorTapHex(0, 0);
    const o1 = ed.tiles.get("0,0").track.orientation;
    window.TrainSetGo.editorTapHex(0, 0); // re-tap rotates
    const o2 = ed.tiles.get("0,0").track.orientation;
    return { o1, o2 };
  });
  expect(orientation.o1).toBe(0);
  expect(orientation.o2).toBe(1);
});
