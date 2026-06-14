// Camera: zoom + pan transform over the isometric scene. Browser-agnostic math. (FR-040)

export class Camera {
  constructor() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.rotation = 0; // radians
    this.minZoom = 0.3;
    this.maxZoom = 4;
  }

  set({ zoom, panX, panY, rotation } = {}) {
    if (typeof zoom === "number") this.zoom = this._clampZoom(zoom);
    if (typeof panX === "number") this.panX = panX;
    if (typeof panY === "number") this.panY = panY;
    if (typeof rotation === "number") this.rotation = rotation;
  }

  get() {
    return { zoom: this.zoom, panX: this.panX, panY: this.panY, rotation: this.rotation };
  }

  _clampZoom(z) {
    return Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }
}
