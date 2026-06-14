// Shared enums/constants for the deterministic game model. DOM-free (FR-050).

export const TerrainType = Object.freeze({
  GRASS: "grass",
  FOREST: "forest",
  LAKE: "lake",
  MOUNTAIN: "mountain",
  MOUNTAIN_TUNNEL: "mountainTunnel",
  TUNNEL_INTERIOR: "tunnelInterior",
  STATION: "station",
  TRACK: "track",
});

export const TrackShape = Object.freeze({
  STRAIGHT: "straight",
  SLIGHT_CURVE: "slightCurve",
  SHARP_CURVE: "sharpCurve",
  SWITCH: "switch",
  CROSSING: "crossing",
});

export const LockState = Object.freeze({
  LOCKED: "locked",
  EDITABLE: "editable",
});

export const TrainStatus = Object.freeze({
  WAITING: "waiting",
  BOARDING: "boarding", // produced and parked at the source station, dwelling before departure
  RUNNING: "running",
  COMPLETED: "completed",
  LOST: "lost",
});

export const RunOutcome = Object.freeze({
  CLEARED: "cleared",
  FAILED: "failed",
});

export const ColorTheme = Object.freeze({
  RED: "red",
  BLUE: "blue",
  GREEN: "green",
  YELLOW: "yellow",
  PURPLE: "purple",
});

// All terrains other than grass are locked by default.
export const EDITABLE_TERRAINS = Object.freeze([TerrainType.GRASS]);

export const EDGE_COUNT = 6;
