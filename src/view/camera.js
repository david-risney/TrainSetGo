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

  rotateBy(deltaRadians) {
    this.rotation += deltaRadians;
  }

  _clampZoom(z) {
    return Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  zoomBy(factor, centerX = 0, centerY = 0) {
    const prev = this.zoom;
    const next = this._clampZoom(prev * factor);
    // Keep the point under (centerX, centerY) stable while zooming.
    const k = next / prev;
    this.panX = centerX - (centerX - this.panX) * k;
    this.panY = centerY - (centerY - this.panY) * k;
    this.zoom = next;
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  // World (scene) point -> screen point.
  worldToScreen(x, y) {
    return { x: x * this.zoom + this.panX, y: y * this.zoom + this.panY };
  }

  // Screen point -> world (scene) point.
  screenToWorld(sx, sy) {
    return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
  }
}
