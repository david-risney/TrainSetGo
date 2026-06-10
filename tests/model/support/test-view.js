// Test-controlled View implementation: records snapshots + event log, no canvas/DOM. (FR-052)

import { View } from "../../../src/view/view-abstraction.js";

export class TestView extends View {
  constructor() {
    super();
    this.lastSnapshot = null;
    this.snapshots = [];
    this.events = [];
    this.camera = { zoom: 1, panX: 0, panY: 0 };
  }

  render(snapshot) {
    this.lastSnapshot = snapshot;
    this.snapshots.push(snapshot);
  }

  onEvent(event) {
    this.events.push(event);
  }

  setCamera(camera) {
    this.camera = { ...camera };
  }

  dispose() {}

  // --- test helpers ---
  eventsOfType(type) {
    return this.events.filter((e) => e.type === type);
  }

  trainById(id) {
    return this.lastSnapshot?.trains.find((t) => t.id === id) ?? null;
  }
}
