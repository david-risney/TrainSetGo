// Tile + TrackPlacement helpers. Pure data with small behavior. (FR-003..FR-006)

import { LockState, TerrainType } from "./constants.js";
import { connectsEdge, exitEdge, isSwitch, switchBranchCount } from "./track.js";

// A TrackPlacement is plain data: { shape, orientation, switchState }.
export function makeTrack(shape, orientation = 0, switchState = null) {
  return {
    shape,
    orientation: ((orientation % 6) + 6) % 6,
    switchState: isSwitch(shape) ? switchState ?? 0 : null,
  };
}

// A Tile is plain data: { q, r, terrain, lock, track, playerPlaced }.
export function makeTile(q, r, terrain, lock, track = null, playerPlaced = false) {
  return { q, r, terrain, lock, track, playerPlaced };
}

export function isEditable(tile) {
  return tile.lock === LockState.EDITABLE;
}

export function hasTrack(tile) {
  return tile.track != null;
}

export function isStation(tile) {
  return tile.terrain === TerrainType.STATION;
}

// Edge-level helpers delegating to track shape logic.
export function tileConnectsEdge(tile, edge) {
  if (!hasTrack(tile)) return false;
  const t = tile.track;
  return connectsEdge(t.shape, t.orientation, t.switchState ?? 0, edge);
}

export function tileExitEdge(tile, enterEdge) {
  if (!hasTrack(tile)) return null;
  const t = tile.track;
  return exitEdge(t.shape, t.orientation, t.switchState ?? 0, enterEdge);
}

export function tileIsSwitch(tile) {
  return hasTrack(tile) && isSwitch(tile.track.shape);
}

export function cycleSwitch(tile) {
  if (!tileIsSwitch(tile)) return false;
  const count = switchBranchCount(tile.track.shape);
  tile.track.switchState = ((tile.track.switchState ?? 0) + 1) % count;
  return true;
}
