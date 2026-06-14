// View Abstraction interface (presentation boundary). The model never imports a concrete
// view; the app calls these methods. See contracts/view-abstraction.md. (FR-050, FR-052)

// Base/no-op view: a concrete view (renderer/audio) or the test view extends/implements this.
export class View {
  // Present a GameModel.getState() snapshot.
  render(_stateSnapshot) {}

  // Receive a discrete gameplay event for audio/feedback.
  // event = { type: "depart"|"arrive"|"crash"|"switchToggle"|"place"|"rotate"|"remove", ... }
  onEvent(_event) {}

  // Apply zoom/pan (real view only).
  setCamera(_camera) {}

  // Release resources.
  dispose() {}
}

// Event type constants for consistency across emitters/listeners.
export const ViewEvent = Object.freeze({
  PRODUCE: "produce",
  DEPART: "depart",
  ARRIVE: "arrive",
  CRASH: "crash",
  SWITCH_TOGGLE: "switchToggle",
  PLACE: "place",
  ROTATE: "rotate",
  REMOVE: "remove",
});
