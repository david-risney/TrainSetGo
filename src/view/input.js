// Pointer Events input: unifies mouse + touch into semantic gestures. Browser-only.
// tap -> onTap(hex), one-finger drag -> onPan(dx,dy), two-finger pinch -> onZoom(factor,cx,cy).
// (FR-040, FR-044, FR-045)

const TAP_MOVE_THRESHOLD = 8; // px
const TAP_TIME_THRESHOLD = 300; // ms

export class InputController {
  constructor(target, handlers = {}) {
    this.target = target;
    this.handlers = handlers; // { onTap, onPan, onZoom }
    this.pointers = new Map();
    this._pinchDist = 0;
    this._pinchAngle = 0;
    this._downPos = null;
    this._downTime = 0;
    this._moved = false;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onWheel = this._onWheel.bind(this);

    target.addEventListener("pointerdown", this._onDown);
    target.addEventListener("pointermove", this._onMove);
    target.addEventListener("pointerup", this._onUp);
    target.addEventListener("pointercancel", this._onUp);
    target.addEventListener("wheel", this._onWheel, { passive: false });
  }

  dispose() {
    const t = this.target;
    t.removeEventListener("pointerdown", this._onDown);
    t.removeEventListener("pointermove", this._onMove);
    t.removeEventListener("pointerup", this._onUp);
    t.removeEventListener("pointercancel", this._onUp);
    t.removeEventListener("wheel", this._onWheel);
  }

  _local(e) {
    const rect = this.target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onDown(e) {
    try {
      this.target.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    const p = this._local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this._downPos = p;
      this._downTime = performance.now();
      this._moved = false;
    } else if (this.pointers.size === 2) {
      this._pinchDist = this._twoFingerDist();
      this._pinchAngle = this._twoFingerAngle();
    }
  }

  _onMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const prev = this.pointers.get(e.pointerId);
    const p = this._local(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      const c = this._twoFingerCenter();
      const dist = this._twoFingerDist();
      if (this._pinchDist > 0) {
        const factor = dist / this._pinchDist;
        this.handlers.onZoom?.(factor, c.x, c.y);
      }
      const angle = this._twoFingerAngle();
      let dAngle = angle - this._pinchAngle;
      // Normalize to [-PI, PI] to avoid jumps at the atan2 wrap.
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
      else if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
      this.handlers.onRotate?.(dAngle, c.x, c.y);
      this._pinchDist = dist;
      this._pinchAngle = angle;
      this._moved = true;
      return;
    }

    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    if (this._downPos) {
      const totDx = p.x - this._downPos.x;
      const totDy = p.y - this._downPos.y;
      if (Math.hypot(totDx, totDy) > TAP_MOVE_THRESHOLD) this._moved = true;
    }
    if (this._moved) this.handlers.onPan?.(dx, dy);
  }

  _onUp(e) {
    const wasSingle = this.pointers.size === 1;
    const p = this.pointers.get(e.pointerId) ?? this._local(e);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this._pinchDist = 0;

    if (wasSingle && !this._moved) {
      const dt = performance.now() - this._downTime;
      if (dt <= TAP_TIME_THRESHOLD) this.handlers.onTap?.(p.x, p.y);
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.target.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.handlers.onZoom?.(factor, cx, cy);
  }

  _twoFingerDist() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _twoFingerAngle() {
    const [a, b] = [...this.pointers.values()];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  _twoFingerCenter() {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}
