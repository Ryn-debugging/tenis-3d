import * as THREE from 'three';

/**
 * BallTrail
 * Zero-allocation ring-buffer 3D ribbon trail and pooled speed-ring accents
 * for the tennis ball. Renders a vibrant rainbow trail on fast and PERFECT shots.
 */
export class BallTrail {
  constructor(scene, maxPoints = 26) {
    this.scene = scene;
    this.maxPoints = maxPoints;

    // Pre-allocated point pool to avoid per-frame object allocations
    this.pointPool = Array.from({ length: maxPoints }, () => ({ x: 0, y: 0, z: 0 }));
    this.activeCount = 0;
    this.headIndex = 0;

    // Rainbow palette matching reference-gameplay (Hot Pink -> Cyan -> Yellow -> Orange)
    this.rainbowStops = [
      { r: 1.0, g: 0.32, b: 0.86 },
      { r: 0.22, g: 0.94, b: 0.98 },
      { r: 1.0, g: 0.92, b: 0.32 },
      { r: 1.0, g: 0.45, b: 0.18 }
    ];

    this.buildRibbonMesh();
    this.buildSpeedRings();
  }

  buildRibbonMesh() {
    const maxPts = this.maxPoints;
    const positions = new Float32Array(maxPts * 2 * 3);
    const colors = new Float32Array(maxPts * 2 * 3);
    const indices = [];

    for (let i = 0; i < maxPts - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }

    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.trailGeo.setIndex(indices);

    this.trailMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.trailMesh = new THREE.Mesh(this.trailGeo, this.trailMat);
    this.trailMesh.frustumCulled = false;
    this.scene.add(this.trailMesh);
  }

  buildSpeedRings() {
    // Pooled wind/speed rings along the trail arc (inspired by reference-gameplay)
    this.ringPoolSize = 4;
    this.speedRings = [];
    const ringGeo = new THREE.RingGeometry(0.24, 0.3, 18);

    for (let i = 0; i < this.ringPoolSize; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.speedRings.push({
        mesh,
        mat,
        active: false,
        timer: 0,
        duration: 0.28
      });
    }
    this.nextRingIndex = 0;
    this.ringSpawnCooldown = 0;
  }

  clear() {
    this.activeCount = 0;
    this.headIndex = 0;
    const posAttr = this.trailGeo.getAttribute('position');
    posAttr.array.fill(0);
    posAttr.needsUpdate = true;

    for (let i = 0; i < this.speedRings.length; i++) {
      this.speedRings[i].active = false;
      this.speedRings[i].mesh.visible = false;
    }
  }

  pushPoint(x, y, z) {
    this.headIndex = (this.headIndex - 1 + this.maxPoints) % this.maxPoints;
    const slot = this.pointPool[this.headIndex];
    slot.x = x;
    slot.y = y;
    slot.z = z;
    if (this.activeCount < this.maxPoints) {
      this.activeCount += 1;
    }
  }

  popOldest() {
    if (this.activeCount > 0) {
      this.activeCount -= 1;
    }
  }

  getPointAt(orderIndex) {
    const clamped = Math.min(orderIndex, Math.max(0, this.activeCount - 1));
    const poolIdx = (this.headIndex + clamped) % this.maxPoints;
    return this.pointPool[poolIdx];
  }

  spawnSpeedRing(x, y, z) {
    const ring = this.speedRings[this.nextRingIndex];
    this.nextRingIndex = (this.nextRingIndex + 1) % this.ringPoolSize;

    ring.active = true;
    ring.timer = ring.duration;
    ring.mesh.position.set(x, y, z);
    ring.mesh.rotation.set(Math.PI * 0.18, 0, 0);
    ring.mesh.scale.setScalar(0.65);
    ring.mat.opacity = 0.72;
    ring.mesh.visible = true;
  }

  updateSpeedRings(dt, physics, isRainbow) {
    if (
      isRainbow &&
      physics.active &&
      !physics.isTossing &&
      physics.bounceCount === 0
    ) {
      this.ringSpawnCooldown -= dt;
      if (this.ringSpawnCooldown <= 0) {
        this.ringSpawnCooldown = 0.085;
        this.spawnSpeedRing(
          physics.position.x,
          physics.position.y,
          physics.position.z
        );
      }
    }

    for (let i = 0; i < this.speedRings.length; i++) {
      const r = this.speedRings[i];
      if (!r.active) continue;
      r.timer = Math.max(0, r.timer - dt);
      const progress = 1.0 - r.timer / r.duration;
      r.mesh.scale.setScalar(0.65 + progress * 1.15);
      r.mat.opacity = (1.0 - progress) * 0.65;
      if (r.timer === 0) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
  }

  update(physics, dt = 1 / 60) {
    if (!physics.active || physics.isTossing) {
      this.popOldest();
    } else {
      this.pushPoint(physics.position.x, physics.position.y, physics.position.z);
    }

    const speed = Math.hypot(
      physics.velocity.x,
      physics.velocity.y,
      physics.velocity.z
    );

    const isRainbow =
      physics.shotGrade === 'PERFECT' ||
      physics.shotType === 'POWER' ||
      physics.shotType === 'SMASH' ||
      speed >= 24.5;
    const isMiss = physics.shotGrade === 'MISS';

    this.updateSpeedRings(dt, physics, isRainbow);

    const posAttr = this.trailGeo.getAttribute('position');
    const colAttr = this.trailGeo.getAttribute('color');
    const count = this.activeCount;

    if (count < 2) {
      posAttr.array.fill(0);
      posAttr.needsUpdate = true;
      return;
    }

    const speedFactor = Math.min(1.38, Math.max(0.65, speed / 22.0));

    for (let i = 0; i < this.maxPoints; i++) {
      const idx = Math.min(i, count - 1);
      const pt = this.getPointAt(idx);
      const t = Math.min(1.0, idx / Math.max(1, count - 1));
      const baseHalfW = isRainbow ? 0.3 : isMiss ? 0.11 : 0.19;
      const halfWidth = (1.0 - t * 0.88) * baseHalfW * speedFactor;

      const vIdx = i * 6;
      posAttr.array[vIdx] = pt.x - halfWidth;
      posAttr.array[vIdx + 1] = pt.y;
      posAttr.array[vIdx + 2] = pt.z;

      posAttr.array[vIdx + 3] = pt.x + halfWidth;
      posAttr.array[vIdx + 4] = pt.y;
      posAttr.array[vIdx + 5] = pt.z;

      let r = 1.0;
      let g = isMiss ? 0.55 : 0.95;
      let b = isMiss ? 0.55 : 0.65;

      if (isRainbow) {
        const stopPos = t * (this.rainbowStops.length - 1);
        const s0 = Math.min(
          this.rainbowStops.length - 1,
          Math.max(0, Math.floor(stopPos))
        );
        const s1 = Math.min(this.rainbowStops.length - 1, s0 + 1);
        const f = stopPos - s0;
        r =
          this.rainbowStops[s0].r +
          (this.rainbowStops[s1].r - this.rainbowStops[s0].r) * f;
        g =
          this.rainbowStops[s0].g +
          (this.rainbowStops[s1].g - this.rainbowStops[s0].g) * f;
        b =
          this.rainbowStops[s0].b +
          (this.rainbowStops[s1].b - this.rainbowStops[s0].b) * f;
      }

      const fade = Math.max(0, 1.0 - t);
      colAttr.array[vIdx] = r * fade;
      colAttr.array[vIdx + 1] = g * fade;
      colAttr.array[vIdx + 2] = b * fade;
      colAttr.array[vIdx + 3] = r * fade;
      colAttr.array[vIdx + 4] = g * fade;
      colAttr.array[vIdx + 5] = b * fade;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
