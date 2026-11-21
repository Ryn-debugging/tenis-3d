import { VirtualJoystick } from './VirtualJoystick.js';
import { TouchController } from './TouchController.js';

/**
 * InputManager
 * Coordinates multi-touch mobile controls (VirtualJoystick + TouchController)
 * and desktop keyboard controls while blocking accidental browser scroll/zoom gestures.
 */
export class InputManager {
  constructor(domElement, callbacks = {}) {
    this.domElement = domElement;
    this.onPauseToggle = callbacks.onPauseToggle || (() => {});

    this.keys = new Set();
    this.moveX = 0;
    this.moveZ = 0;

    // Normalized output from VirtualJoystick (-1..1)
    this.virtualMoveX = 0;
    this.virtualMoveZ = 0;

    this.queuedShotType = null;

    // Initialize left-side Virtual Joystick
    this.joystick = new VirtualJoystick(
      document.getElementById('joystick-zone'),
      document.getElementById('joystick-base'),
      document.getElementById('joystick-knob'),
      (vx, vy) => {
        this.virtualMoveX = vx;
        this.virtualMoveZ = vy;
      }
    );

    // Initialize right-side Touch Action Buttons & Pause button
    this.touchController = new TouchController({
      onAction: (actionType) => {
        this.queueShot(actionType);
      },
      onPauseToggle: () => {
        this.onPauseToggle();
      }
    });

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Prevent accidental mobile browser scrolling, pinch-zoom, and text selection
    const preventGesture = (e) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('gesturestart', preventGesture, { passive: false });
    window.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('selectstart', preventGesture, { passive: false });
    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.joystick.reset();
    });
  }

  onKeyDown(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (!e.repeat) {
        this.onPauseToggle();
      }
      return;
    }

    this.keys.add(e.code);

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!e.repeat) this.queueShot('NORMAL');
    } else if (e.code === 'KeyJ') {
      if (!e.repeat) this.queueShot('POWER');
    } else if (e.code === 'KeyK') {
      if (!e.repeat) this.queueShot('LOB');
    } else if (e.code === 'KeyL') {
      if (!e.repeat) this.queueShot('SMASH');
    }
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
  }

  queueShot(shotType = 'NORMAL') {
    this.queuedShotType = shotType;
  }

  consumeShotRequest() {
    const shot = this.queuedShotType;
    this.queuedShotType = null;
    return shot;
  }

  resetAllInput() {
    this.keys.clear();
    this.queuedShotType = null;
    this.virtualMoveX = 0;
    this.virtualMoveZ = 0;
    this.moveX = 0;
    this.moveZ = 0;
    if (this.joystick) {
      this.joystick.reset();
    }
  }

  updateTouchContext(contextState) {
    if (this.touchController) {
      this.touchController.updateContext(contextState);
    }
  }

  update() {
    let kx = 0;
    let kz = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kz += 1;

    // Virtual joystick takes priority when active, otherwise keyboard input
    if (this.virtualMoveX !== 0 || this.virtualMoveZ !== 0) {
      this.moveX = this.virtualMoveX;
      this.moveZ = this.virtualMoveZ;
    } else if (kx !== 0 || kz !== 0) {
      const len = Math.hypot(kx, kz);
      this.moveX = kx / len;
      this.moveZ = kz / len;
    } else {
      this.moveX = 0;
      this.moveZ = 0;
    }
  }
}
