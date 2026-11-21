import * as THREE from 'three';
import { ParticleManager } from './ParticleManager.js';

/**
 * EffectManager
 * Coordinates 3D gameplay visual effects:
 * - Pooled ParticleManager bursts (impact, foot dust, court bounce, celebration)
 * - 3D Racket Impact Flash Ring & Starburst Sprite
 * - 3D Clay Court Bounce Ripple Ring & Ground Shockwave under character on PERFECT shots
 * - Quality scaling for mobile performance ('high' vs 'low')
 */
export class EffectManager {
  constructor(scene, assetManager) {
    this.scene = scene;
    this.assetManager = assetManager;
    this.qualityMode = 'high'; // 'high' | 'low'

    this.particles = new ParticleManager(scene, 72);

    this.footDustTimers = {
      player: 0,
      ai: 0
    };

    this.impactFlashTimer = 0;
    this.impactFlashDuration = 0.24;
    this.impactFlashMaxScale = 2.0;

    this.bounceRippleTimer = 0;
    this.bounceRippleDuration = 0.3;

    this.perfectGroundRingTimer = 0;
    this.perfectGroundRingDuration = 0.34;

    this.buildEffectMeshes();
  }

  buildEffectMeshes() {
    // 1. 3D Racket Impact Flash Ring & Additive Glow Sprite
    this.impactFlashGroup = new THREE.Group();
    this.impactRingMat = new THREE.MeshBasicMaterial({
      color: 0xff6ec7,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.impactRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.5, 24),
      this.impactRingMat
    );
    this.impactRingMesh.rotation.x = -Math.PI / 3;
    this.impactFlashGroup.add(this.impactRingMesh);

    this.impactSpriteMat = new THREE.SpriteMaterial({
      map: this.assetManager.textures.glow,
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.impactSprite = new THREE.Sprite(this.impactSpriteMat);
    this.impactSprite.scale.set(1.9, 1.9, 1.0);
    this.impactFlashGroup.add(this.impactSprite);
    this.impactFlashGroup.visible = false;
    this.scene.add(this.impactFlashGroup);

    // 2. Clay Court Bounce Ripple Ring
    this.bounceRippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.bounceRippleMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.34, 24),
      this.bounceRippleMat
    );
    this.bounceRippleMesh.rotation.x = -Math.PI / 2;
    this.bounceRippleMesh.position.y = 0.024;
    this.bounceRippleMesh.visible = false;
    this.scene.add(this.bounceRippleMesh);

    // 3. Cyan/Magenta Ground Shockwave Ring beneath player on PERFECT shots (matching reference-gameplay)
    this.perfectGroundMat = new THREE.MeshBasicMaterial({
      color: 0x38f9d7,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.perfectGroundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.74, 28),
      this.perfectGroundMat
    );
    this.perfectGroundRing.rotation.x = -Math.PI / 2;
    this.perfectGroundRing.position.y = 0.026;
    this.perfectGroundRing.visible = false;
    this.scene.add(this.perfectGroundRing);
  }

  setQualityMode(mode = 'high') {
    this.qualityMode = mode === 'low' ? 'low' : 'high';
    this.particles.setQualityScale(this.qualityMode === 'low' ? 0.5 : 1.0);
  }

  onRacketHit(ballPos, charPos, grade = 'GOOD', shotType = 'NORMAL') {
    // 1. Trigger 3D Impact Flash Ring
    this.impactFlashGroup.position.set(ballPos.x, ballPos.y, ballPos.z);
    this.impactFlashGroup.visible = true;
    this.impactFlashTimer = this.impactFlashDuration;

    const isStrong =
      grade === 'PERFECT' || shotType === 'POWER' || shotType === 'SMASH';

    if (isStrong) {
      this.impactRingMat.color.setHex(
        shotType === 'POWER' ? 0xff7b00 : 0xff3cac
      );
      this.impactSpriteMat.color.setHex(0xffe066);
      this.impactFlashMaxScale = shotType === 'SMASH' ? 2.65 : 2.2;

      if (charPos) {
        this.perfectGroundRing.position.set(charPos.x, 0.026, charPos.z);
        this.perfectGroundRing.visible = true;
        this.perfectGroundRingTimer = this.perfectGroundRingDuration;
      }
    } else if (grade === 'GOOD') {
      this.impactRingMat.color.setHex(0x2ee59d);
      this.impactSpriteMat.color.setHex(0xffffff);
      this.impactFlashMaxScale = 1.65;
    } else {
      this.impactRingMat.color.setHex(0xff6b6b);
      this.impactSpriteMat.color.setHex(0xffaaaa);
      this.impactFlashMaxScale = 1.25;
    }

    // 2. Emit Pooled Impact Particles
    this.particles.emitRacketImpact(ballPos, grade, shotType);
  }

  onBallBounce(pos, isIn = true) {
    this.bounceRippleMesh.position.set(pos.x, 0.024, pos.z);
    this.bounceRippleMesh.visible = true;
    this.bounceRippleTimer = this.bounceRippleDuration;
    this.bounceRippleMat.color.setHex(isIn ? 0xfff3bf : 0xff6b6b);

    this.particles.emitCourtBounce(pos, isIn);
  }

  onCharacterMove(side, pos, speed, dt) {
    if (speed < 2.2) return;
    const interval = this.qualityMode === 'low' ? 0.24 : 0.13;
    this.footDustTimers[side] = (this.footDustTimers[side] || 0) + dt;
    if (this.footDustTimers[side] >= interval) {
      this.footDustTimers[side] = 0;
      this.particles.emitFootDust(pos);
    }
  }

  onPointCelebration(winnerPos, isMatchWin = false) {
    if (!winnerPos) return;
    this.particles.emitCelebration(winnerPos, isMatchWin);
  }

  update(dt) {
    this.particles.update(dt);

    if (this.impactFlashTimer > 0) {
      this.impactFlashTimer = Math.max(0, this.impactFlashTimer - dt);
      const progress = 1.0 - this.impactFlashTimer / this.impactFlashDuration;
      const scale = 0.45 + progress * this.impactFlashMaxScale;
      this.impactRingMesh.scale.setScalar(scale);
      this.impactRingMat.opacity = (1.0 - progress) * 0.9;
      this.impactSprite.scale.setScalar((1.0 - progress * 0.5) * 1.95);
      this.impactSpriteMat.opacity = (1.0 - progress) * 0.95;
      if (this.impactFlashTimer === 0) {
        this.impactFlashGroup.visible = false;
      }
    }

    if (this.bounceRippleTimer > 0) {
      this.bounceRippleTimer = Math.max(0, this.bounceRippleTimer - dt);
      const progress = 1.0 - this.bounceRippleTimer / this.bounceRippleDuration;
      const scale = 0.75 + progress * 1.95;
      this.bounceRippleMesh.scale.setScalar(scale);
      this.bounceRippleMat.opacity = (1.0 - progress) * 0.85;
      if (this.bounceRippleTimer === 0) {
        this.bounceRippleMesh.visible = false;
      }
    }

    if (this.perfectGroundRingTimer > 0) {
      this.perfectGroundRingTimer = Math.max(0, this.perfectGroundRingTimer - dt);
      const progress =
        1.0 - this.perfectGroundRingTimer / this.perfectGroundRingDuration;
      this.perfectGroundRing.scale.setScalar(0.8 + progress * 1.55);
      this.perfectGroundMat.opacity = (1.0 - progress) * 0.88;
      if (this.perfectGroundRingTimer === 0) {
        this.perfectGroundRing.visible = false;
      }
    }
  }
}
