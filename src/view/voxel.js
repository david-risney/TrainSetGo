// Voxel palette + isometric sprite baking with a cache. Browser-only (uses canvas).
// Approximates voxel models as colored hex prisms composited in 2D (research R1). (FR-039)

import { TerrainType, ColorTheme } from "../model/constants.js";

export const TERRAIN_COLORS = {
  [TerrainType.GRASS]: { top: "#5aa75a", side: "#3f7d3f" },
  [TerrainType.FOREST]: { top: "#2f6b34", side: "#1f4a24" },
  [TerrainType.LAKE]: { top: "#3d7fd6", side: "#2a5da0" },
  [TerrainType.MOUNTAIN]: { top: "#8a8f99", side: "#5f636b" },
  [TerrainType.MOUNTAIN_TUNNEL]: { top: "#6f7480", side: "#4a4e57" },
  [TerrainType.TUNNEL_INTERIOR]: { top: "#3a3d44", side: "#26282d" },
  [TerrainType.STATION]: { top: "#caa86a", side: "#9a7c44" },
  [TerrainType.TRACK]: { top: "#6a8f5a", side: "#4f6d43" },
};

export const THEME_COLORS = {
  [ColorTheme.RED]: "#e2524a",
  [ColorTheme.BLUE]: "#4a82e2",
  [ColorTheme.GREEN]: "#54bf63",
  [ColorTheme.YELLOW]: "#e2c84a",
  [ColorTheme.PURPLE]: "#a05ce0",
};

export function themeColor(color) {
  return THEME_COLORS[color] ?? "#dddddd";
}

export function terrainColor(terrain) {
  return TERRAIN_COLORS[terrain] ?? { top: "#888", side: "#555" };
}

// Elevation (in scene units) used to give terrain a voxel "height".
export function terrainHeight(terrain) {
  switch (terrain) {
    case TerrainType.MOUNTAIN:
      return 26;
    case TerrainType.MOUNTAIN_TUNNEL:
      return 22;
    case TerrainType.FOREST:
      return 12;
    case TerrainType.STATION:
      return 10;
    case TerrainType.LAKE:
      return 2;
    default:
      return 6;
  }
}

// A tiny cache placeholder; renderer draws prisms directly, but other code may
// pre-bake sprites here in future. Kept to honor the voxel-baking task seam.
const _cache = new Map();
export function clearSpriteCache() {
  _cache.clear();
}
export function cacheSize() {
  return _cache.size;
}
