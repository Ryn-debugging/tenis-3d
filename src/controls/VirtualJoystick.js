/**
 * VirtualJoystick
 * Left-side multi-touch virtual thumbstick using Pointer Events.
 * Tracks its own dedicated pointerId so simultaneous right-hand button presses
 * never interrupt player movement.
 */
export class VirtualJoystick {
  constructor(zoneElement, baseElement, knobElement, onMoveCallback) {
    this.zone = zoneElement;
    this.base = baseElement;
    this.knob = knobElement;
    this.onMove = onMoveCallback;

    this.activePointerId = null;
    this.centerX = 0;
    this.centerY = 0;
    this.maxRadius = 46;
    this.deadzone = 0.12;

    this.valueX = 0;
    this.valueY = 0;

    if (this.zone && this.base && this.knob) {
      this.bindEvents();
    }
  }

  bindEvents() {
    this.zone.addEventListener('pointerdown', (e) => this.handlePointerDown(e), {
      passive: false
    });
    this.zone.addEventListener('pointermove', (e) => this.handlePointerMove(e), {
      passive: false
    });
    this.zone.addEventListener('pointerup', (e) => this.handlePointerUp(e), {
      passive: false
    });
    this.zone.addEventListener('pointercancel', (e) => this.handlePointerUp(e), {
      passive: false
    });
    this.zone.addEventListener('lostpointercapture', (e) => this.handlePointerUp(e), {
      passive: false
    });
    this.zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  handlePointerDown(e) {
    if (this.activePointerId !== null) return;
    e.preventDefault();
    e.stopPropagation();

    this.activePointerId = e.pointerId;
    try {
      this.zone.setPointerCapture(e.pointerId);
    } catch (_) {
      // Ignore if synthetic event does not support pointer capture
    }

    const baseRect = this.base.getBoundingClientRect();
    this.maxRadius = Math.max(32, baseRect.width * 0.36);

    // Center reference at the joystick base center
    this.centerX = baseRect.left + baseRect.width * 0.5;
    this.centerY = baseRect.top + baseRect.height * 0.5;

    this.base.classList.add('joystick-active');
    this.updateFromClientPoint(e.clientX, e.clientY);
  }

  handlePointerMove(e) {
    if (this.activePointerId === null || e.pointerId !== this.activePointerId) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    this.updateFromClientPoint(e.clientX, e.clientY);
  }

  handlePointerUp(e) {
    if (this.activePointerId === null || e.pointerId !== this.activePointerId) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    this.reset();
  }

  updateFromClientPoint(clientX, clientY) {
    const dx = clientX - this.centerX;
    const dy = clientY - this.centerY;
    const dist = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > this.maxRadius && dist > 0) {
      clampedX = (dx / dist) * this.maxRadius;
      clampedY = (dy / dist) * this.maxRadius;
    }

    // Visual knob translation
    this.knob.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;

    const normMag = Math.min(1.0, dist / this.maxRadius);
    if (normMag < this.deadzone || dist === 0) {
      this.valueX = 0;
      this.valueY = 0;
    } else {
      const rescaled = (normMag - this.deadzone) / (1.0 - this.deadzone);
      this.valueX = (dx / dist) * rescaled;
      this.valueY = (dy / dist) * rescaled;
    }

    if (this.onMove) {
      this.onMove(this.valueX, this.valueY);
    }
  }

  reset() {
    this.activePointerId = null;
    this.valueX = 0;
    this.valueY = 0;
    if (this.base) {
      this.base.classList.remove('joystick-active');
    }
    if (this.knob) {
      this.knob.style.transform = 'translate3d(0px, 0px, 0)';
    }
    if (this.onMove) {
      this.onMove(0, 0);
    }
  }
}
