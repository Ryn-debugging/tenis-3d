import * as THREE from 'three';

/**
 * CameraManager
 * Manages the fixed elevated perspective camera matching reference-gameplay.
 * Handles responsive framing on resize/orientation change and subtle impact shake/punch.
 */
export class CameraManager {
  constructor() {
    this.baseFov = 40;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 16 / 9, 0.5, 140);

    // Base position behind the bottom baseline, elevated ~43 deg pitch
    this.basePosition = new THREE.Vector3(0, 19.4, 25.6);
    this.lookAtTarget = new THREE.Vector3(0, 0.0, 1.45);

    this.currentOffset = new THREE.Vector3();
    this.shakeEnabled = true;
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
    this.shakeDuration = 0.001;

    this.punchFovDelta = 0;

    this.updateFraming(window.innerWidth, window.innerHeight);
  }

  setShakeEnabled(enabled = true) {
    this.shakeEnabled = Boolean(enabled);
    if (!this.shakeEnabled) {
      this.shakeTimer = 0;
      this.punchFovDelta = 0;
    }
  }

  /**
   * Adjusts camera FOV and distance so the full court width and depth stay framed
   * across 16:9, 20:9, 4:3, or portrait viewports.
   */
  updateFraming(width, height) {
    const safeWidth = Math.max(width, 1);
    const safeHeight = Math.max(height, 1);
    const aspect = safeWidth / safeHeight;

    this.camera.aspect = aspect;

    const refAspect = 16 / 9;
    let distanceScale = 1.0;

    if (aspect < refAspect) {
      distanceScale = Math.min(1.65, Math.pow(refAspect / Math.max(aspect, 0.55), 0.72));
    } else if (aspect > 2.05) {
      distanceScale = 1.04;
    }

    this.camera.fov = this.baseFov + this.punchFovDelta;
    this.camera.position.set(
      this.basePosition.x,
      this.basePosition.y * distanceScale,
      this.basePosition.z * distanceScale
    );
    this.camera.lookAt(this.lookAtTarget);
    this.camera.updateProjectionMatrix();
  }

  triggerShake(intensity = 0.18, duration = 0.16, fovPunch = -0.75) {
    if (!this.shakeEnabled) return;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(duration, 0.05);
    this.shakeTimer = this.shakeDuration;
    this.punchFovDelta = fovPunch;
  }

  update(dt) {
    if (Math.abs(this.punchFovDelta) > 0.01) {
      this.punchFovDelta += (0 - this.punchFovDelta) * Math.min(1, dt * 14);
      this.camera.fov = this.baseFov + this.punchFovDelta;
      this.camera.updateProjectionMatrix();
    } else if (this.punchFovDelta !== 0) {
      this.punchFovDelta = 0;
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const decay = this.shakeTimer / this.shakeDuration;
      const mag = this.shakeIntensity * decay;
      this.currentOffset.set(
        (Math.random() - 0.5) * 2 * mag,
        (Math.random() - 0.5) * 2 * mag,
        0
      );
      this.camera.position.add(this.currentOffset);
      this.camera.lookAt(
        this.lookAtTarget.x + this.currentOffset.x * 0.35,
        this.lookAtTarget.y + this.currentOffset.y * 0.35,
        this.lookAtTarget.z
      );
      this.camera.position.sub(this.currentOffset);
    }
  }
}
