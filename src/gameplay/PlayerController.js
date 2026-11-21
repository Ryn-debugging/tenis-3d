import { COURT_CONFIG } from '../core/SceneManager.js';
import { CHARACTER_ROSTER } from '../core/AssetManager.js';
import { RacketController } from './RacketController.js';

/**
 * PlayerController
 * Controls the bottom-court playable chibi character: movement, court boundary clamping,
 * optional movement assistance, dynamic 3D character swapping, and all 8 Phase 4 procedural
 * chibi animation states ('idle', 'run', 'serve', 'forehand', 'backhand', 'smash', 'win', 'lose').
 */
export class PlayerController {
  constructor(scene, assetManager, characterId = 'angel') {
    this.scene = scene;
    this.assetManager = assetManager;

    this.characterId = CHARACTER_ROSTER[characterId] ? characterId : 'angel';
    this.characterProfile = CHARACTER_ROSTER[this.characterId];

    this.mesh = this.assetManager.createChibiCharacter(this.characterId);
    this.scene.add(this.mesh);

    this.racket = new RacketController('player', this.mesh);

    this.position = { x: 2.2, y: 0, z: 12.2 };
    this.velocity = { x: 0, z: 0 };
    this.moveSpeed = this.characterProfile.moveSpeed;
    this.assistStrength = 0.42;
    this.assistEnabled = true;

    this.bounds = {
      minX: -(COURT_CONFIG.PLAYABLE_HALF_WIDTH + 1.8),
      maxX: COURT_CONFIG.PLAYABLE_HALF_WIDTH + 1.8,
      minZ: 1.15,
      maxZ: COURT_CONFIG.HALF_LENGTH + 2.4
    };

    this.animTime = 0;
    this.recoilTimer = 0;
    this.canMove = true;

    this.animState = 'idle'; // 'idle' | 'run' | 'serve' | 'forehand' | 'backhand' | 'smash' | 'win' | 'lose'
    this.forcedState = null;
    this.forcedStateTimer = 0;

    this.syncMesh();
  }

  /**
   * Swaps the 3D playable character rig on the court and updates movement speed.
   */
  setCharacter(characterId = 'angel') {
    const resolvedId = CHARACTER_ROSTER[characterId] ? characterId : 'angel';
    this.characterId = resolvedId;
    this.characterProfile = CHARACTER_ROSTER[resolvedId];
    this.moveSpeed = this.characterProfile.moveSpeed;

    const oldConfig = this.racket ? { ...this.racket.config } : {};
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }

    this.mesh = this.assetManager.createChibiCharacter(this.characterId);
    this.scene.add(this.mesh);
    this.racket = new RacketController('player', this.mesh, oldConfig);
    this.syncMesh();
    return this.characterProfile;
  }

  setMovementAssist(enabled = true) {
    this.assistEnabled = Boolean(enabled);
  }

  triggerHitRecoil() {
    this.recoilTimer = 0.16;
  }

  /**
   * Explicitly sets or overrides the character's animation state.
   */
  setAnimState(state, duration = 0) {
    this.forcedState = state;
    this.forcedStateTimer = duration;
    if (state) {
      this.animState = state;
    }
    if (state === 'serve') {
      this.racket.setPoseOverride('serve_toss');
    } else if (state === 'win' || state === 'lose') {
      this.racket.setPoseOverride(state);
    } else if (
      state === 'forehand' ||
      state === 'backhand' ||
      state === 'smash'
    ) {
      this.racket.isSwinging = false;
      this.racket.setPoseOverride(null);
      const shotMap = {
        forehand: 'NORMAL',
        backhand: 'NORMAL',
        smash: 'SMASH'
      };
      const offsetX = state === 'backhand' ? -1.0 : 1.0;
      const ballY = state === 'smash' ? 2.2 : 1.0;
      this.racket.startSwing(shotMap[state], offsetX, ballY);
    } else {
      this.racket.setPoseOverride(null);
    }
  }

  clearForcedAnimState() {
    this.forcedState = null;
    this.forcedStateTimer = 0;
    this.racket.setPoseOverride(null);
  }

  setServePosition(serveSide = 'deuce', isServer = true) {
    const sideSign = serveSide === 'deuce' ? 1 : -1;
    this.position.x = sideSign * (isServer ? 2.1 : 3.0);
    this.position.z = isServer
      ? COURT_CONFIG.HALF_LENGTH + 0.35
      : COURT_CONFIG.HALF_LENGTH + 0.5;
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.clearForcedAnimState();
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  update(dt, inputManager, ballPhysics) {
    this.animTime += dt;

    if (this.forcedStateTimer > 0) {
      this.forcedStateTimer = Math.max(0, this.forcedStateTimer - dt);
      if (this.forcedStateTimer === 0) {
        this.clearForcedAnimState();
      }
    }

    const moveX = inputManager.moveX;
    const moveZ = inputManager.moveZ;
    const hasManualInput = Math.hypot(moveX, moveZ) > 0.05;

    if (this.canMove) {
      if (hasManualInput) {
        this.velocity.x = moveX * this.moveSpeed;
        this.velocity.z = moveZ * this.moveSpeed;
      } else if (
        this.assistEnabled &&
        ballPhysics.active &&
        !ballPhysics.isTossing &&
        ballPhysics.lastHitter === 'ai' &&
        !ballPhysics.blockedByNet
      ) {
        const pred = ballPhysics.predictLanding();
        if (pred && pred.bounceZ > 0) {
          const targetX = pred.strikeX;
          const targetZ = Math.max(
            this.bounds.minZ + 0.5,
            Math.min(this.bounds.maxZ - 0.3, pred.strikeZ + 0.55)
          );
          const dx = targetX - this.position.x;
          const dz = targetZ - this.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.65) {
            const assistSpeed = this.moveSpeed * this.assistStrength;
            this.velocity.x = (dx / dist) * assistSpeed;
            this.velocity.z = (dz / dist) * assistSpeed;
          } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
          }
        } else {
          this.velocity.x = 0;
          this.velocity.z = 0;
        }
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;

      this.position.x = Math.max(
        this.bounds.minX,
        Math.min(this.bounds.maxX, this.position.x)
      );
      this.position.z = Math.max(
        this.bounds.minZ,
        Math.min(this.bounds.maxZ, this.position.z)
      );
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    this.resolveAnimState(ballPhysics);
    this.syncMesh();
    this.updateProceduralAnimation(dt);
    this.racket.updateAnimation(dt, this.animTime);
  }

  resolveAnimState(ballPhysics) {
    if (this.racket.isSwinging) {
      this.forcedState = null;
      this.animState = this.racket.swingHand; // 'serve' | 'smash' | 'forehand' | 'backhand'
      return;
    }

    if (this.forcedState) {
      this.animState = this.forcedState;
      return;
    }

    if (ballPhysics && ballPhysics.active && ballPhysics.isTossing && ballPhysics.lastHitter === 'player') {
      this.animState = 'serve';
      this.racket.setPoseOverride('serve_toss');
      return;
    }

    this.racket.setPoseOverride(null);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animState = speed > 0.35 ? 'run' : 'idle';
  }

  updateProceduralAnimation(dt) {
    const ud = this.mesh.userData;
    if (!ud || !ud.visualGroup) return;

    const vg = ud.visualGroup;
    const hg = ud.headGroup;
    const leftArm = ud.leftArm;

    let targetScaleX = 1.0;
    let targetScaleY = 1.0;
    let targetScaleZ = 1.0;
    let targetPosY = 0.0;
    let targetRotX = 0.0;
    let targetRotY = 0.0;
    let targetRotZ = 0.0;
    let headRotX = 0.0;
    let headRotY = 0.0;
    let armRotX = 0.0;
    let armRotZ = 0.22;

    const swingProgress = this.racket.isSwinging
      ? Math.min(1.0, this.racket.swingTimer / this.racket.config.swingDuration)
      : 0;

    switch (this.animState) {
      case 'run': {
        const runCycle = this.animTime * 15.5;
        targetPosY = Math.abs(Math.sin(runCycle)) * 0.16;
        // Squash at foot plant, stretch at hop apex
        const stretch = Math.sin(runCycle * 2) * 0.055;
        targetScaleY = 1.0 + stretch;
        targetScaleX = 1.0 - stretch * 0.5;
        targetScaleZ = 1.0 - stretch * 0.5;
        targetRotZ = -this.velocity.x * 0.02;
        targetRotX = this.velocity.z * 0.015;
        armRotX = Math.cos(runCycle) * 0.65;

        if (ud.leftFoot && ud.rightFoot) {
          ud.leftFoot.position.z = Math.sin(runCycle) * 0.18;
          ud.rightFoot.position.z = -Math.sin(runCycle) * 0.18;
        }
        break;
      }

      case 'serve': {
        if (!this.racket.isSwinging) {
          // Toss anticipation: arch back, stretch tall, raise left tossing arm
          targetScaleX = 0.93;
          targetScaleY = 1.11;
          targetScaleZ = 0.93;
          targetRotX = 0.16;
          targetRotY = -0.22;
          headRotX = 0.28;
          armRotX = 2.1;
          armRotZ = 0.1;
        } else {
          // Explosive serve strike and follow-through
          const snap = Math.sin(swingProgress * Math.PI);
          targetPosY = snap * 0.24;
          targetScaleY = 1.0 + snap * 0.1;
          targetScaleX = 1.0 - snap * 0.05;
          targetRotX = 0.15 - swingProgress * 0.42;
          targetRotY = -0.2 + swingProgress * 0.48;
          armRotX = 1.6 - swingProgress * 2.0;
        }
        break;
      }

      case 'forehand': {
        // Anticipation coil (0..0.25) -> whip follow-through (0.25..1.0)
        const coil =
          swingProgress < 0.25
            ? -(swingProgress / 0.25) * 0.38
            : -0.38 + ((swingProgress - 0.25) / 0.75) * 0.92;
        targetRotY = coil;
        targetRotX = -Math.sin(swingProgress * Math.PI) * 0.12;
        armRotZ = 0.55;
        armRotX = -coil * 0.8;
        break;
      }

      case 'backhand': {
        const coil =
          swingProgress < 0.25
            ? (swingProgress / 0.25) * 0.42
            : 0.42 - ((swingProgress - 0.25) / 0.75) * 0.96;
        targetRotY = coil;
        targetRotX = -Math.sin(swingProgress * Math.PI) * 0.12;
        armRotZ = 0.48;
        armRotX = coil * 0.7;
        break;
      }

      case 'smash': {
        // High leap + overhead arch anticipation + downward slam + landing squash
        const jumpArc = Math.sin(swingProgress * Math.PI);
        targetPosY = jumpArc * 0.52;
        const stretch = swingProgress < 0.65 ? jumpArc * 0.14 : -0.09;
        targetScaleY = 1.0 + stretch;
        targetScaleX = 1.0 - stretch * 0.5;
        targetScaleZ = 1.0 - stretch * 0.5;
        targetRotX = 0.22 - swingProgress * 0.55;
        headRotX = 0.25 - swingProgress * 0.4;
        armRotX = 1.8 - swingProgress * 2.2;
        break;
      }

      case 'win': {
        const hopCycle = this.animTime * 10.5;
        const hop = Math.abs(Math.sin(hopCycle));
        targetPosY = hop * 0.36;
        const stretch = (hop - 0.4) * 0.14;
        targetScaleY = 1.0 + stretch;
        targetScaleX = 1.0 - stretch * 0.5;
        targetScaleZ = 1.0 - stretch * 0.5;
        targetRotY = Math.sin(this.animTime * 5.0) * 0.45;
        targetRotZ = Math.cos(this.animTime * 5.0) * 0.08;
        armRotZ = 2.4 + Math.sin(this.animTime * 14) * 0.3;
        headRotX = 0.12;
        break;
      }

      case 'lose': {
        targetScaleX = 1.08;
        targetScaleY = 0.86;
        targetScaleZ = 1.08;
        targetRotX = -0.16;
        headRotX = -0.28;
        headRotY = Math.sin(this.animTime * 4.2) * 0.24;
        armRotZ = 0.08;
        break;
      }

      case 'idle':
      default: {
        const idleCycle = this.animTime * 3.6;
        targetPosY = Math.abs(Math.sin(idleCycle)) * 0.035;
        const breathe = Math.sin(idleCycle * 2) * 0.025;
        targetScaleY = 1.0 + breathe;
        targetScaleX = 1.0 - breathe * 0.45;
        targetScaleZ = 1.0 - breathe * 0.45;
        if (ud.leftFoot && ud.rightFoot) {
          ud.leftFoot.position.z = 0;
          ud.rightFoot.position.z = 0;
        }
        break;
      }
    }

    // Layer impact recoil squash-and-stretch punch on top
    if (this.recoilTimer > 0) {
      this.recoilTimer = Math.max(0, this.recoilTimer - dt);
      const t = this.recoilTimer / 0.16;
      const punch = Math.sin(t * Math.PI) * 0.14;
      targetScaleX *= 1.0 - punch * 0.4;
      targetScaleY *= 1.0 + punch;
      targetScaleZ *= 1.0 - punch * 0.4;
    }

    vg.position.y = targetPosY;
    vg.scale.set(targetScaleX, targetScaleY, targetScaleZ);
    vg.rotation.x += (targetRotX - vg.rotation.x) * Math.min(1, dt * 16);
    vg.rotation.y += (targetRotY - vg.rotation.y) * Math.min(1, dt * 16);
    vg.rotation.z += (targetRotZ - vg.rotation.z) * Math.min(1, dt * 16);

    if (hg) {
      hg.rotation.x += (headRotX - hg.rotation.x) * Math.min(1, dt * 14);
      hg.rotation.y += (headRotY - hg.rotation.y) * Math.min(1, dt * 14);
    }

    if (leftArm) {
      leftArm.rotation.x += (armRotX - leftArm.rotation.x) * Math.min(1, dt * 14);
      leftArm.rotation.z += (armRotZ - leftArm.rotation.z) * Math.min(1, dt * 14);
    }

    // Floating Golden Halo bob & wing flutter
    if (ud.haloMesh) {
      ud.haloMesh.position.y = 0.68 + Math.sin(this.animTime * 4.5) * 0.045;
      ud.haloMesh.rotation.z = this.animTime * 1.4;
    }
    if (ud.leftWing && ud.rightWing) {
      const flapFreq =
        this.animState === 'win' || this.animState === 'smash'
          ? 22
          : this.animState === 'run'
          ? 16
          : 5;
      const flapAmp = this.animState === 'lose' ? 0.04 : 0.16;
      const flap = Math.sin(this.animTime * flapFreq) * flapAmp;
      ud.leftWing.rotation.y = 0.28 + flap;
      ud.rightWing.rotation.y = -0.28 - flap;
    }
  }
}
