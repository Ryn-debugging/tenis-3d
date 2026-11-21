import { COURT_CONFIG } from '../core/SceneManager.js';
import { RacketController } from './RacketController.js';

export const AI_DIFFICULTY_PRESETS = {
  easy: {
    label: 'Easy',
    reactionDelay: 0.25,
    moveSpeed: 7.2,
    predictionError: 0.85,
    perfectRate: 0.18,
    aggressiveness: 0.25
  },
  normal: {
    label: 'Normal',
    reactionDelay: 0.13,
    moveSpeed: 9.2,
    predictionError: 0.32,
    perfectRate: 0.48,
    aggressiveness: 0.55
  },
  hard: {
    label: 'Hard',
    reactionDelay: 0.05,
    moveSpeed: 11.2,
    predictionError: 0.06,
    perfectRate: 0.82,
    aggressiveness: 0.85
  }
};

/**
 * AIController
 * Local JavaScript opponent controlling the top-court Yellow Duck character.
 * Predicts incoming ball trajectories with difficulty-based reaction delay, movement limits,
 * tactical shot selection, and all 8 Phase 4 procedural animation states:
 * 'idle', 'run', 'serve', 'forehand', 'backhand', 'smash', 'win', 'lose'.
 */
export class AIController {
  constructor(scene, assetManager, difficulty = 'normal') {
    this.scene = scene;
    this.assetManager = assetManager;

    this.mesh = this.assetManager.createChibiCharacter('duck');
    this.scene.add(this.mesh);

    this.racket = new RacketController('ai', this.mesh);

    this.position = { x: -2.2, y: 0, z: -12.2 };
    this.velocity = { x: 0, z: 0 };

    this.bounds = {
      minX: -(COURT_CONFIG.PLAYABLE_HALF_WIDTH + 1.8),
      maxX: COURT_CONFIG.PLAYABLE_HALF_WIDTH + 1.8,
      minZ: -(COURT_CONFIG.HALF_LENGTH + 2.4),
      maxZ: -1.15
    };

    this.setDifficulty(difficulty);

    this.targetPos = { x: 0, z: -11.0 };
    this.reactionTimer = 0;
    this.hasLockedPrediction = false;
    this.predictionNoiseX = 0;
    this.predictionNoiseZ = 0;
    this.trackedShotId = null;

    this.animTime = 0;
    this.recoilTimer = 0;
    this.animState = 'idle'; // 'idle' | 'run' | 'serve' | 'forehand' | 'backhand' | 'smash' | 'win' | 'lose'
    this.forcedState = null;
    this.forcedStateTimer = 0;

    this.syncMesh();
  }

  triggerHitRecoil() {
    this.recoilTimer = 0.16;
  }

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
      const offsetX = state === 'backhand' ? 1.0 : -1.0;
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

  setDifficulty(level = 'normal') {
    this.difficultyKey = AI_DIFFICULTY_PRESETS[level] ? level : 'normal';
    this.preset = AI_DIFFICULTY_PRESETS[this.difficultyKey];
  }

  setServePosition(serveSide = 'deuce', isServer = false) {
    const sideSign = serveSide === 'deuce' ? -1 : 1;
    this.position.x = sideSign * (isServer ? 2.1 : 2.75);
    this.position.z = isServer
      ? -(COURT_CONFIG.HALF_LENGTH + 0.35)
      : -(COURT_CONFIG.HALF_LENGTH - 0.6);
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.homePos = { x: this.position.x, z: this.position.z };
    this.targetPos.x = this.position.x;
    this.targetPos.z = this.position.z;
    this.hasLockedPrediction = false;
    this.clearForcedAnimState();
    this.syncMesh();
  }

  notifyPlayerHitBall() {
    this.reactionTimer = this.preset.reactionDelay;
    this.hasLockedPrediction = false;
    this.predictionNoiseX = (Math.random() - 0.5) * 2 * this.preset.predictionError;
    this.predictionNoiseZ = (Math.random() - 0.5) * this.preset.predictionError;
  }

  syncMesh() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  /**
   * Updates AI positioning, trajectory prediction, and returns a shot command if the AI strikes the ball.
   * Returns null or { shotType, aimX, aimZ, grade }
   */
  update(dt, ballPhysics, playerPos) {
    this.animTime += dt;
    let executedShot = null;

    if (this.forcedStateTimer > 0) {
      this.forcedStateTimer = Math.max(0, this.forcedStateTimer - dt);
      if (this.forcedStateTimer === 0) {
        this.clearForcedAnimState();
      }
    }

    // 1. Check if AI is currently serving and waiting for toss apex
    if (ballPhysics.active && ballPhysics.isTossing && ballPhysics.lastHitter === 'ai') {
      if (ballPhysics.position.y >= 1.9 && ballPhysics.velocity.y <= 1.2) {
        const contact = this.racket.evaluateContact(this.position, ballPhysics);
        if (contact.canHit) {
          this.racket.startSwing('SERVE', 0, ballPhysics.position.y);
          this.triggerHitRecoil();
          const aimX = (Math.random() - 0.5) * 1.1;
          this.homePos = { x: 0, z: -10.8 };
          executedShot = {
            shotType: 'SERVE',
            aimX,
            aimZ: 0,
            grade: Math.random() < this.preset.perfectRate ? 'PERFECT' : 'GOOD'
          };
        }
      }
    } else if (
      ballPhysics.active &&
      !ballPhysics.isTossing &&
      ballPhysics.lastHitter === 'player' &&
      !ballPhysics.blockedByNet
    ) {
      // 2. Ball is approaching AI's side
      if (this.reactionTimer > 0) {
        this.reactionTimer = Math.max(0, this.reactionTimer - dt);
      } else {
        if (ballPhysics.bounceCount === 0) {
          const pred = ballPhysics.predictLanding();
          if (pred && pred.bounceZ <= 0.5) {
            this.targetPos.x = pred.strikeX + this.predictionNoiseX;
            this.targetPos.z = Math.min(
              this.bounds.maxZ,
              Math.max(this.bounds.minZ, pred.strikeZ - 0.35 + this.predictionNoiseZ)
            );
            this.hasLockedPrediction = true;
          }
        } else {
          this.targetPos.x = ballPhysics.position.x + ballPhysics.velocity.x * 0.08;
          this.targetPos.z = Math.min(
            this.bounds.maxZ,
            Math.max(this.bounds.minZ, ballPhysics.position.z - 0.3)
          );
        }

        const readyToStrike =
          ballPhysics.bounceCount === 1 ||
          (ballPhysics.position.z < -1.2 &&
            Math.abs(ballPhysics.position.z - this.position.z) < 1.35 &&
            ballPhysics.bounceCount === 0 &&
            this.position.z > -5.5);

        if (readyToStrike && !this.racket.isSwinging) {
          const contact = this.racket.evaluateContact(this.position, ballPhysics);
          const lastResortLunge = ballPhysics.position.z <= this.position.z + 0.35;
          if (contact.canHit && (contact.grade !== 'MISS' || lastResortLunge)) {
            const decision = this.chooseReturnShot(ballPhysics, playerPos, contact.grade);
            const offsetX = ballPhysics.position.x - this.position.x;
            this.racket.startSwing(
              decision.shotType,
              offsetX,
              ballPhysics.position.y
            );
            this.triggerHitRecoil();
            this.homePos = { x: 0, z: -10.8 };
            executedShot = decision;
          }
        }
      }
    } else {
      const home = this.homePos || { x: 0, z: -10.8 };
      this.targetPos.x = home.x;
      this.targetPos.z = home.z;
    }

    // Move smoothly toward targetPos respecting AI speed limits and court bounds
    const dx = this.targetPos.x - this.position.x;
    const dz = this.targetPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.12 && !this.forcedState) {
      const stepSpeed = Math.min(this.preset.moveSpeed, dist / Math.max(dt, 0.008));
      this.velocity.x = (dx / dist) * stepSpeed;
      this.velocity.z = (dz / dist) * stepSpeed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    this.position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.position.x));
    this.position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.position.z));

    this.resolveAnimState(ballPhysics);
    this.syncMesh();
    this.updateProceduralAnimation(dt);
    this.racket.updateAnimation(dt, this.animTime);

    return executedShot;
  }

  resolveAnimState(ballPhysics) {
    if (this.racket.isSwinging) {
      this.forcedState = null;
      this.animState = this.racket.swingHand;
      return;
    }

    if (this.forcedState) {
      this.animState = this.forcedState;
      return;
    }

    if (ballPhysics && ballPhysics.active && ballPhysics.isTossing && ballPhysics.lastHitter === 'ai') {
      this.animState = 'serve';
      this.racket.setPoseOverride('serve_toss');
      return;
    }

    this.racket.setPoseOverride(null);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animState = speed > 0.35 ? 'run' : 'idle';
  }

  chooseReturnShot(ballPhysics, playerPos, rawContactGrade) {
    let grade = rawContactGrade;
    if (grade === 'PERFECT' && Math.random() > this.preset.perfectRate) {
      grade = 'GOOD';
    }

    let shotType = 'NORMAL';
    if (ballPhysics.position.y > 1.7 && this.position.z > -6.5) {
      shotType = 'SMASH';
    } else if (playerPos && playerPos.z < 5.5 && Math.random() < this.preset.aggressiveness) {
      shotType = 'LOB';
    } else if (Math.random() < this.preset.aggressiveness * 0.45) {
      shotType = 'POWER';
    }

    const playerX = playerPos ? playerPos.x : 0;
    const openCourtDir = playerX >= 0 ? -1 : 1;
    const placementWeight = this.preset.aggressiveness;
    const randomSpread = (Math.random() - 0.5) * 0.7;

    let aimX =
      openCourtDir * (0.45 + 0.38 * placementWeight) +
      randomSpread * (1 - placementWeight * 0.6);
    aimX = Math.max(-0.92, Math.min(0.92, aimX));

    return {
      shotType,
      aimX,
      aimZ: 0,
      grade
    };
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
    let armRotZ = -0.22;

    const swingProgress = this.racket.isSwinging
      ? Math.min(1.0, this.racket.swingTimer / this.racket.config.swingDuration)
      : 0;

    switch (this.animState) {
      case 'run': {
        const runCycle = this.animTime * 15.5;
        targetPosY = Math.abs(Math.sin(runCycle)) * 0.15;
        const stretch = Math.sin(runCycle * 2) * 0.055;
        targetScaleY = 1.0 + stretch;
        targetScaleX = 1.0 - stretch * 0.5;
        targetScaleZ = 1.0 - stretch * 0.5;
        targetRotZ = -this.velocity.x * 0.02;
        targetRotX = this.velocity.z * 0.015;
        armRotX = Math.cos(runCycle) * 0.6;

        if (ud.leftFoot && ud.rightFoot) {
          ud.leftFoot.position.z = Math.sin(runCycle) * 0.17;
          ud.rightFoot.position.z = -Math.sin(runCycle) * 0.17;
        }
        break;
      }

      case 'serve': {
        if (!this.racket.isSwinging) {
          targetScaleX = 0.93;
          targetScaleY = 1.11;
          targetScaleZ = 0.93;
          targetRotX = -0.15;
          targetRotY = 0.22;
          headRotX = -0.25;
          armRotX = -2.0;
        } else {
          const snap = Math.sin(swingProgress * Math.PI);
          targetPosY = snap * 0.22;
          targetScaleY = 1.0 + snap * 0.1;
          targetRotX = -0.15 + swingProgress * 0.4;
          targetRotY = 0.2 - swingProgress * 0.45;
        }
        break;
      }

      case 'forehand': {
        const coil =
          swingProgress < 0.25
            ? (swingProgress / 0.25) * 0.38
            : 0.38 - ((swingProgress - 0.25) / 0.75) * 0.9;
        targetRotY = coil;
        targetRotX = Math.sin(swingProgress * Math.PI) * 0.12;
        armRotZ = -0.52;
        break;
      }

      case 'backhand': {
        const coil =
          swingProgress < 0.25
            ? -(swingProgress / 0.25) * 0.4
            : -0.4 + ((swingProgress - 0.25) / 0.75) * 0.92;
        targetRotY = coil;
        targetRotX = Math.sin(swingProgress * Math.PI) * 0.12;
        armRotZ = -0.45;
        break;
      }

      case 'smash': {
        const jumpArc = Math.sin(swingProgress * Math.PI);
        targetPosY = jumpArc * 0.48;
        const stretch = swingProgress < 0.65 ? jumpArc * 0.13 : -0.08;
        targetScaleY = 1.0 + stretch;
        targetScaleX = 1.0 - stretch * 0.5;
        targetScaleZ = 1.0 - stretch * 0.5;
        targetRotX = -0.2 + swingProgress * 0.52;
        break;
      }

      case 'win': {
        const hopCycle = this.animTime * 10.5;
        const hop = Math.abs(Math.sin(hopCycle));
        targetPosY = hop * 0.34;
        const stretch = (hop - 0.4) * 0.13;
        targetScaleY = 1.0 + stretch;
        targetScaleX = 1.0 - stretch * 0.5;
        targetScaleZ = 1.0 - stretch * 0.5;
        targetRotY = Math.sin(this.animTime * 5.0) * 0.45;
        armRotZ = -2.3 - Math.sin(this.animTime * 14) * 0.3;
        break;
      }

      case 'lose': {
        targetScaleX = 1.08;
        targetScaleY = 0.86;
        targetScaleZ = 1.08;
        targetRotX = 0.16;
        headRotX = 0.28;
        headRotY = Math.sin(this.animTime * 4.2) * 0.24;
        break;
      }

      case 'idle':
      default: {
        const idleCycle = this.animTime * 3.8;
        targetPosY = Math.abs(Math.sin(idleCycle)) * 0.032;
        const breathe = Math.sin(idleCycle * 2) * 0.022;
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

    if (ud.tuft) {
      ud.tuft.rotation.z = 0.22 + Math.sin(this.animTime * 8) * 0.12;
    }
  }
}
