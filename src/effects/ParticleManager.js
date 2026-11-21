import * as THREE from 'three';

/**
 * ParticleManager
 * Pre-allocated object pool for 3D arcade particle effects:
 * - Racket impact bursts (stronger multi-color bursts on PERFECT / POWER / SMASH)
 * - Clay footstep dust puffs when characters move
 * - Court bounce chalk/clay splash particles
 * - Point / Match celebration confetti bursts
 */
export class ParticleManager {
  constructor(scene, poolSize = 72) {
    this.scene = scene;
    this.poolSize = poolSize;
    this.qualityScale = 1.0; // 1.0 = High, 0.5 = Low mobile fallback

    this.pool = [];
    this.nextIndex = 0;

    this.buildPool();
  }

  buildPool() {
    this.sharedGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    for (let i = 0; i < this.poolSize; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.visible = false;
      this.particleGroup.add(mesh);

      this.pool.push({
        mesh,
        mat,
        active: false,
        age: 0,
        lifetime: 0.4,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 12.0,
        rotSpeedX: 0,
        rotSpeedY: 0,
        startScale: 1.0,
        endScale: 0.1
      });
    }
  }

  setQualityScale(scale = 1.0) {
    this.qualityScale = Math.max(0.35, Math.min(1.0, scale));
  }

  acquireParticle() {
    const slot = this.pool[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.poolSize;
    return slot;
  }

  spawnParticle({
    x,
    y,
    z,
    vx,
    vy,
    vz,
    colorHex,
    lifetime = 0.42,
    gravity = 12.0,
    startScale = 1.0,
    endScale = 0.08
  }) {
    const p = this.acquireParticle();
    p.active = true;
    p.age = 0;
    p.lifetime = lifetime;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.gravity = gravity;
    p.startScale = startScale;
    p.endScale = endScale;
    p.rotSpeedX = (Math.random() - 0.5) * 14;
    p.rotSpeedY = (Math.random() - 0.5) * 14;

    p.mat.color.setHex(colorHex);
    p.mat.opacity = 1.0;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(startScale);
    p.mesh.visible = true;
  }

  /**
   * Spawns a burst of particles at the racket contact point.
   * Stronger and more colorful for PERFECT, POWER, and SMASH shots.
   */
  emitRacketImpact(pos, grade = 'GOOD', shotType = 'NORMAL') {
    const isStrong =
      grade === 'PERFECT' || shotType === 'POWER' || shotType === 'SMASH';
    const baseCount = isStrong ? 16 : grade === 'GOOD' ? 8 : 5;
    const count = Math.max(2, Math.round(baseCount * this.qualityScale));

    const palette = isStrong
      ? [0xff3cac, 0xffe066, 0x38f9d7, 0xffffff, 0xff922b]
      : grade === 'GOOD'
      ? [0x2ee59d, 0xffffff, 0xffe066]
      : [0xff7b7b, 0xffcccc];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = (isStrong ? 4.2 : 2.6) + Math.random() * (isStrong ? 3.8 : 2.0);
      const colorHex = palette[i % palette.length];

      this.spawnParticle({
        x: pos.x + (Math.random() - 0.5) * 0.2,
        y: pos.y + (Math.random() - 0.5) * 0.2,
        z: pos.z + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(angle) * speed,
        vy: 1.8 + Math.random() * (isStrong ? 3.8 : 2.2),
        vz: Math.sin(angle) * speed,
        colorHex,
        lifetime: isStrong ? 0.46 : 0.34,
        gravity: 11.5,
        startScale: isStrong ? 1.25 : 0.85,
        endScale: 0.05
      });
    }
  }

  /**
   * Spawns small clay dust particles at a moving character's feet.
   */
  emitFootDust(pos) {
    const count = this.qualityScale >= 0.75 ? 2 : 1;
    const dustColors = [0xf2a679, 0xfce37d, 0xe07a48];

    for (let i = 0; i < count; i++) {
      this.spawnParticle({
        x: pos.x + (Math.random() - 0.5) * 0.45,
        y: 0.1 + Math.random() * 0.08,
        z: pos.z + (Math.random() - 0.5) * 0.35,
        vx: (Math.random() - 0.5) * 1.1,
        vy: 0.9 + Math.random() * 0.85,
        vz: (Math.random() - 0.5) * 1.1,
        colorHex: dustColors[i % dustColors.length],
        lifetime: 0.32,
        gravity: 2.2,
        startScale: 0.78,
        endScale: 0.15
      });
    }
  }

  /**
   * Spawns court bounce particles when the ball strikes the clay surface.
   */
  emitCourtBounce(pos, isIn = true) {
    const baseCount = 8;
    const count = Math.max(3, Math.round(baseCount * this.qualityScale));
    const palette = isIn
      ? [0xffffff, 0xfce37d, 0xf2a679]
      : [0xff6b6b, 0xd9534f, 0xaa3322];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 1.6 + Math.random() * 2.1;

      this.spawnParticle({
        x: pos.x,
        y: 0.08,
        z: pos.z,
        vx: Math.cos(angle) * speed,
        vy: 1.8 + Math.random() * 1.9,
        vz: Math.sin(angle) * speed,
        colorHex: palette[i % palette.length],
        lifetime: 0.36,
        gravity: 13.0,
        startScale: 0.82,
        endScale: 0.08
      });
    }
  }

  /**
   * Spawns celebration confetti and sparkles around the point or match winner.
   */
  emitCelebration(pos, isMatchWin = false) {
    const baseCount = isMatchWin ? 24 : 12;
    const count = Math.max(5, Math.round(baseCount * this.qualityScale));
    const palette = [0xff3cac, 0xffe066, 0x38f9d7, 0x2ee59d, 0xffffff];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = 1.8 + Math.random() * (isMatchWin ? 4.2 : 2.6);

      this.spawnParticle({
        x: pos.x + (Math.random() - 0.5) * 0.6,
        y: (pos.y || 0) + 1.15 + Math.random() * 0.5,
        z: pos.z + (Math.random() - 0.5) * 0.6,
        vx: Math.cos(angle) * speed,
        vy: 3.4 + Math.random() * (isMatchWin ? 4.2 : 2.5),
        vz: Math.sin(angle) * speed,
        colorHex: palette[i % palette.length],
        lifetime: isMatchWin ? 0.85 : 0.55,
        gravity: 7.5,
        startScale: isMatchWin ? 1.3 : 1.0,
        endScale: 0.15
      });
    }
  }

  getActiveParticleCount() {
    let active = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) active += 1;
    }
    return active;
  }

  clearAll() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].mesh.visible = false;
    }
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.age += dt;
      if (p.age >= p.lifetime) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const progress = p.age / p.lifetime;
      p.vy -= p.gravity * dt;

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.04, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;

      p.mesh.rotation.x += p.rotSpeedX * dt;
      p.mesh.rotation.y += p.rotSpeedY * dt;

      const scale = p.startScale + (p.endScale - p.startScale) * progress;
      p.mesh.scale.setScalar(Math.max(0.01, scale));
      p.mat.opacity = 1.0 - progress;
    }
  }
}
