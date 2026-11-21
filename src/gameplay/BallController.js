import * as THREE from 'three';
import { BallPhysics } from './BallPhysics.js';
import { BallTrail } from '../effects/BallTrail.js';

/**
 * BallController
 * Synchronizes BallPhysics with the 3D glowing tennis ball mesh, ground shadow blob,
 * predicted bounce ring, and zero-allocation BallTrail.
 */
export class BallController {
  constructor(scene, assetManager, callbacks = {}) {
    this.scene = scene;
    this.assetManager = assetManager;

    this.physics = new BallPhysics(callbacks);
    this.trailMaxPoints = 26;
    this.ballTrail = new BallTrail(scene, this.trailMaxPoints);

    this.buildVisuals();
  }

  buildVisuals() {
    // 1. Ball Core Sphere
    const ballGeo = new THREE.SphereGeometry(this.physics.radius, 20, 20);
    this.ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff85e4,
      emissiveIntensity: 0.78,
      roughness: 0.18
    });
    this.ballMesh = new THREE.Mesh(ballGeo, this.ballMat);
    this.scene.add(this.ballMesh);

    // 2. Additive Halo Glow Sprite attached to ball
    const spriteMat = new THREE.SpriteMaterial({
      map: this.assetManager.textures.glow,
      color: 0xff99ee,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.glowSprite = new THREE.Sprite(spriteMat);
    this.glowSprite.scale.set(1.4, 1.4, 1.0);
    this.ballMesh.add(this.glowSprite);

    // 3. Ground Shadow Disc directly under ball (essential for 3D height readability)
    this.shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.98, 0.98),
      new THREE.MeshBasicMaterial({
        map: this.assetManager.textures.shadow,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      })
    );
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.018;
    this.scene.add(this.shadowMesh);

    // 4. Predicted First-Bounce Landing Ring on Court
    this.landingRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.48, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffdf4d,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.landingRing.rotation.x = -Math.PI / 2;
    this.landingRing.position.y = 0.022;
    this.landingRing.visible = false;
    this.scene.add(this.landingRing);
  }

  clearTrail() {
    this.ballTrail.clear();
  }

  setShotVisualStyle(grade = 'GOOD', shotType = 'NORMAL') {
    this.ballTrail.clear();

    if (grade === 'PERFECT' || shotType === 'POWER' || shotType === 'SMASH') {
      this.ballMat.emissive.setHex(0xff49c4);
      this.ballMat.emissiveIntensity = 1.08;
      this.glowSprite.scale.set(1.95, 1.95, 1.0);
      this.ballTrail.trailMat.opacity = 0.92;
    } else if (grade === 'GOOD') {
      this.ballMat.emissive.setHex(0xffe066);
      this.ballMat.emissiveIntensity = 0.72;
      this.glowSprite.scale.set(1.35, 1.35, 1.0);
      this.ballTrail.trailMat.opacity = 0.7;
    } else {
      this.ballMat.emissive.setHex(0xff7b7b);
      this.ballMat.emissiveIntensity = 0.35;
      this.glowSprite.scale.set(0.95, 0.95, 1.0);
      this.ballTrail.trailMat.opacity = 0.44;
    }
  }

  stepPhysics(fixedDt) {
    this.physics.step(fixedDt);
  }

  updateVisuals(time, dt = 1 / 60) {
    const { x, y, z } = this.physics.position;
    this.ballMesh.position.set(x, y, z);

    // Shadow disc tracks (x, z) on clay court and scales with ball altitude
    this.shadowMesh.position.set(x, 0.018, z);
    const heightFactor = Math.max(0.35, 1.0 - y * 0.11);
    this.shadowMesh.scale.setScalar(heightFactor);
    this.shadowMesh.material.opacity = 0.74 * heightFactor;

    // Show landing marker before first bounce during active flight
    if (
      this.physics.active &&
      !this.physics.isTossing &&
      this.physics.bounceCount === 0 &&
      !this.physics.blockedByNet
    ) {
      const pred = this.physics.predictLanding();
      if (pred) {
        this.landingRing.visible = true;
        this.landingRing.position.set(pred.bounceX, 0.022, pred.bounceZ);
        const pulse = 0.92 + Math.sin(time * 12) * 0.1;
        this.landingRing.scale.setScalar(pulse);
      } else {
        this.landingRing.visible = false;
      }
    } else {
      this.landingRing.visible = false;
    }

    this.ballTrail.update(this.physics, dt);
  }
}
