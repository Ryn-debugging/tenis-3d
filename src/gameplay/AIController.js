import { COURT_CONFIG } from '../core/SceneManager.js';
import { RacketController } from './RacketController.js';

/**
 * Rebalanced AI Difficulty Presets
 * Tuned so EASY (700-1000ms), NORMAL (350-550ms), and HARD (150-250ms) produce
 * genuinely distinct, fair, human-like opponent behavior while remaining strictly beatable.
 */
export const AI_DIFFICULTY_PRESETS = {
  easy: {
    label: 'Easy',
    reactionDelayMin: 0.7,
    reactionDelayMax: 1.0,
    reactionDelay: 0.85,
    moveSpeed: 5.2,
    acceleration: 13.0,
    homeRecoverySpeedScale: 0.65,
    predictionError: 1.65,
    postBounceNoiseScale: 0.75,
    reachConfig: {
      maxReachX: 1.55,
      maxReachZ: 1.65,
      goodWindowX: 1.25,
      goodWindowZ: 1.2,
      perfectWindowX: 0.72,
      perfectWindowZ: 0.52
    },
    perfectRate: 0.06,
    weakReturnRate: 0.36,
    missReachableChance: 0.22,
    unforcedErrorOutRate: 0.14,
    allowSmash: false,
    smashChance: 0.0,
    powerShotChance: 0.05,
    lobChance: 0.08,
    placementAccuracy: 0.32,
    shotScatter: 0.95,
    aggressiveness: 0.2
  },
  normal: {
    label: 'Normal',
    reactionDelayMin: 0.35,
    reactionDelayMax: 0.55,
    reactionDelay: 0.45,
    moveSpeed: 7.0,
    acceleration: 20.0,
    homeRecoverySpeedScale: 0.78,
    predictionError: 0.95,
    postBounceNoiseScale: 0.6,
    reachConfig: {
      maxReachX: 1.78,
      maxReachZ: 1.88,
      goodWindowX: 1.48,
      goodWindowZ: 1.42,
      perfectWindowX: 0.9,
      perfectWindowZ: 0.65
    },
    perfectRate: 0.2,
    weakReturnRate: 0.18,
    missReachableChance: 0.11,
    unforcedErrorOutRate: 0.07,
    allowSmash: true,
    smashChance: 0.38,
    powerShotChance: 0.16,
    lobChance: 0.2,
    placementAccuracy: 0.56,
    shotScatter: 0.62,
    aggressiveness: 0.42
  },
  hard: {
    label: 'Hard',
    reactionDelayMin: 0.15,
    reactionDelayMax: 0.25,
    reactionDelay: 0.2,
    moveSpeed: 8.4,
    acceleration: 26.0,
    homeRecoverySpeedScale: 0.9,
    predictionError: 0.48,
    postBounceNoiseScale: 0.42,
    reachConfig: {
      maxReachX: 1.92,
      maxReachZ: 2.0,
      goodWindowX: 1.62,
      goodWindowZ: 1.54,
      perfectWindowX: 1.05,
      perfectWindowZ: 0.74
    },
    perfectRate: 0.38,
    weakReturnRate: 0.09,
    missReachableChance: 0.05,
    unforcedErrorOutRate: 0.04,
    allowSmash: true,
    smashChance: 0.72,
    powerShotChance: 0.3,
    lobChance: 0.34,
    placementAccuracy: 0.78,
    shotScatter: 0.36,
    aggressiveness: 0.65
  }
};

/**
 * AIController
 * Local JavaScript opponent controlling the top-court Yellow Duck character.
 * Enforces strict fairness rules:
 * - Zero pre-hit destination foresight (only reacts after player hits the ball).
 * - Randomized human reaction delay per difficulty (Easy 700-1000ms, Normal 350-550ms, Hard 150-250ms).
 * - Physical velocity & acceleration limits inside court boundaries (no teleporting).
 * - Persistent positioning error, difficulty-tuned reach, realistic whiffs & unforced errors.
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

    this.homePos = { x: 0, z: -10.8 };
    this.targetPos = { x: 0, z: -11.0 };

    this.reactionTimer = 0;
    this.lastAssignedReactionDelay = 0;
    this.hasLockedPrediction = false;
    this.hasEvaluatedIncomingBall = false;
    this.willWhiffCurrentShot = false;
    this.hasWhiffedCurrentShot = false;
    this.currentRallyHitCount = 0;
    this.predictionNoiseX = 0;
    this.predictionNoiseZ = 0;
    this.trackedShotId = null;

    // Telemetry counters for gameplay balancing tests
    this.stats = {
      shotsAttempted: 0,
      whiffedReachableShots: 0,
      smashesExecuted: 0,
      perfectReturns: 0,
      weakReturns: 0,
      unforcedErrors: 0
    };

    this.setDifficulty(difficulty);

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
    if (this.racket && this.preset.reachConfig) {
      this.racket.setTimingConfig(this.preset.reachConfig);
    }
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
    this.reactionTimer = 0;
    this.hasLockedPrediction = false;
    this.hasEvaluatedIncomingBall = false;
    this.willWhiffCurrentShot = false;
    this.hasWhiffedCurrentShot = false;
    this.clearForcedAnimState();
    this.syncMesh();
  }

  /**
   * Called ONLY AFTER the player strikes the ball.
   * Assigns a randomized human reaction delay within the active difficulty's [min, max] range
   * and clears prior tracking so AI cannot know the destination before reacting.
   */
  notifyPlayerHitBall(context = {}) {
    const minD = this.preset.reactionDelayMin;
    const maxD = this.preset.reactionDelayMax;
    const rolledDelay = minD + Math.random() * (maxD - minD);

    this.lastAssignedReactionDelay = rolledDelay;
    this.reactionTimer = rolledDelay;
    this.hasLockedPrediction = false;
    this.hasEvaluatedIncomingBall = false;
    this.willWhiffCurrentShot = false;
    this.hasWhiffedCurrentShot = false;
    this.currentRallyHitCount = context.rallyHitCount || 1;

    // Roll positioning error once per incoming ball (persists after bounce)
    this.predictionNoiseX = (Math.random() - 0.5) * 2 * this.preset.predictionError;
    this.predictionNoiseZ = (Math.random() - 0.5) * 2 * this.preset.predictionError;

    // During reaction delay, AI only continues toward neutral home recovery — never toward the new ball
    const home = this.homePos || { x: 0, z: -10.8 };
    this.targetPos.x = home.x;
    this.targetPos.z = home.z;
  }

  /**
   * Evaluates once per incoming shot (after reaction delay finishes) whether the AI
   * will misjudge timing and whiff a reachable ball based on difficulty, movement stretch,
   * incoming shot velocity/type, and rally length.
   */
  evaluateIncomingBallMistake(ballPhysics, predictedStrikePos) {
    this.hasEvaluatedIncomingBall = true;
    this.willWhiffCurrentShot = false;

    const lateralDist = predictedStrikePos
      ? Math.abs(predictedStrikePos.strikeX - this.position.x)
      : Math.abs(ballPhysics.position.x - this.position.x);

    const isFastShot =
      ballPhysics.shotType === 'POWER' ||
      ballPhysics.shotType === 'SMASH' ||
      ballPhysics.shotGrade === 'PERFECT';

    // Gentle straight first shot right at AI's body initiates a rally smoothly;
    // angled shots, fast shots, and ongoing rally exchanges apply full mistake probability.
    if (lateralDist <= 1.15 && !isFastShot && this.currentRallyHitCount <= 1) {
      return;
    }

    let missProb = this.preset.missReachableChance;
    if (isFastShot) {
      missProb += this.difficultyKey === 'easy' ? 0.14 : this.difficultyKey === 'normal' ? 0.08 : 0.06;
    }
    if (lateralDist > 2.4) {
      missProb += this.difficultyKey === 'easy' ? 0.12 : this.difficultyKey === 'normal' ? 0.06 : 0.04;
    }
    if (this.currentRallyHitCount >= 4) {
      // Fatigue / rally pressure so even Hard AI stays beatable in extended rallies
      missProb += this.difficultyKey === 'easy' ? 0.12 : this.difficultyKey === 'normal' ? 0.05 : 0.03;
    }

    if (Math.random() < Math.min(0.6, missProb)) {
      this.willWhiffCurrentShot = true;
    }
  }

  syncMesh() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  /**
   * Updates AI positioning, trajectory prediction, and returns a shot command if the AI strikes the ball.
   * Returns null or { shotType, aimX, aimZ, grade, unforcedError }
   */
  update(dt, ballPhysics, playerPos) {
    this.animTime += dt;
    let executedShot = null;
    let isRecoveringHome = false;

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
          const aimSpread = this.difficultyKey === 'easy' ? 0.55 : this.difficultyKey === 'normal' ? 0.9 : 1.15;
          const aimX = (Math.random() - 0.5) * aimSpread;
          this.homePos = { x: 0, z: -10.8 };

          let serveGrade = 'GOOD';
          const roll = Math.random();
          if (roll < this.preset.perfectRate) {
            serveGrade = 'PERFECT';
          } else if (roll > 1 - this.preset.weakReturnRate * 0.65) {
            serveGrade = 'MISS';
          }

          executedShot = {
            shotType: 'SERVE',
            aimX,
            aimZ: 0,
            grade: serveGrade,
            unforcedError: false
          };
        }
      }
    } else if (
      ballPhysics.active &&
      !ballPhysics.isTossing &&
      ballPhysics.lastHitter === 'player' &&
      !ballPhysics.blockedByNet
    ) {
      // 2. Ball is approaching AI's side — strictly respect reaction delay before predicting!
      if (this.reactionTimer > 0) {
        this.reactionTimer = Math.max(0, this.reactionTimer - dt);
        isRecoveringHome = true;
      } else {
        let predicted = null;
        if (ballPhysics.bounceCount === 0) {
          predicted = ballPhysics.predictLanding();
          if (predicted && predicted.bounceZ <= 0.5) {
            this.targetPos.x = Math.max(
              this.bounds.minX,
              Math.min(this.bounds.maxX, predicted.strikeX + this.predictionNoiseX)
            );
            this.targetPos.z = Math.min(
              this.bounds.maxZ,
              Math.max(this.bounds.minZ, predicted.strikeZ - 0.35 + this.predictionNoiseZ)
            );
            this.hasLockedPrediction = true;
          }
        } else {
          // After first bounce, retain scaled positioning error (never zero-error heat-seeking)
          const postNoiseX = this.predictionNoiseX * this.preset.postBounceNoiseScale;
          const postNoiseZ = this.predictionNoiseZ * this.preset.postBounceNoiseScale;
          this.targetPos.x = Math.max(
            this.bounds.minX,
            Math.min(
              this.bounds.maxX,
              ballPhysics.position.x + ballPhysics.velocity.x * 0.05 + postNoiseX
            )
          );
          this.targetPos.z = Math.min(
            this.bounds.maxZ,
            Math.max(this.bounds.minZ, ballPhysics.position.z - 0.32 + postNoiseZ)
          );
        }

        if (!this.hasEvaluatedIncomingBall) {
          this.evaluateIncomingBallMistake(ballPhysics, predicted);
        }

        const readyToStrike =
          ballPhysics.bounceCount === 1 ||
          (ballPhysics.position.z < -1.2 &&
            Math.abs(ballPhysics.position.z - this.position.z) < 1.25 &&
            ballPhysics.bounceCount === 0 &&
            this.position.z > -5.5 &&
            this.difficultyKey !== 'easy');

        if (readyToStrike && !this.racket.isSwinging && !this.hasWhiffedCurrentShot) {
          const contact = this.racket.evaluateContact(this.position, ballPhysics);
          if (contact.canHit) {
            // If AI rolled a reachable-ball timing whiff, perform visible late swing without hitting ball
            if (this.willWhiffCurrentShot) {
              const offsetX = ballPhysics.position.x - this.position.x;
              this.racket.startSwing('NORMAL', offsetX, ballPhysics.position.y);
              this.hasWhiffedCurrentShot = true;
              this.stats.shotsAttempted += 1;
              this.stats.whiffedReachableShots += 1;
            } else {
              const lastResortLunge =
                ballPhysics.position.z <= this.position.z + 0.25 &&
                this.difficultyKey !== 'easy';

              if (contact.grade !== 'MISS' || lastResortLunge) {
                const decision = this.chooseReturnShot(ballPhysics, playerPos, contact.grade);
                const offsetX = ballPhysics.position.x - this.position.x;
                this.racket.startSwing(
                  decision.shotType,
                  offsetX,
                  ballPhysics.position.y
                );
                this.triggerHitRecoil();
                this.homePos = { x: 0, z: -10.8 };
                this.stats.shotsAttempted += 1;
                if (decision.shotType === 'SMASH') this.stats.smashesExecuted += 1;
                if (decision.grade === 'PERFECT') this.stats.perfectReturns += 1;
                if (decision.grade === 'MISS') this.stats.weakReturns += 1;
                if (decision.unforcedError) this.stats.unforcedErrors += 1;
                executedShot = decision;
              }
            }
          }
        }
      }
    } else {
      // Ball is on player's side or inactive — drift calmly to neutral home position (zero foresight)
      const home = this.homePos || { x: 0, z: -10.8 };
      this.targetPos.x = home.x;
      this.targetPos.z = home.z;
      isRecoveringHome = true;
    }

    // Move smoothly with physical acceleration and strict speed limits (never teleport)
    const dx = this.targetPos.x - this.position.x;
    const dz = this.targetPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    const maxSpeed = isRecoveringHome
      ? this.preset.moveSpeed * this.preset.homeRecoverySpeedScale
      : this.preset.moveSpeed;

    let desiredVx = 0;
    let desiredVz = 0;
    if (dist > 0.14 && !this.forcedState) {
      const targetSpeed = Math.min(maxSpeed, dist / Math.max(dt, 0.04));
      desiredVx = (dx / dist) * targetSpeed;
      desiredVz = (dz / dist) * targetSpeed;
    }

    const dvx = desiredVx - this.velocity.x;
    const dvz = desiredVz - this.velocity.z;
    const dvMag = Math.hypot(dvx, dvz);
    const maxDeltaV = this.preset.acceleration * dt;

    if (dvMag > maxDeltaV && dvMag > 0.0001) {
      this.velocity.x += (dvx / dvMag) * maxDeltaV;
      this.velocity.z += (dvz / dvMag) * maxDeltaV;
    } else {
      this.velocity.x = desiredVx;
      this.velocity.z = desiredVz;
    }

    // Strict maximum speed cap
    const curSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (curSpeed > this.preset.moveSpeed) {
      const clampRatio = this.preset.moveSpeed / curSpeed;
      this.velocity.x *= clampRatio;
      this.velocity.z *= clampRatio;
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Strictly enforce court boundaries
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
    // Cap PERFECT rate and inject realistic weak (MISS-grade) returns by difficulty
    let grade = rawContactGrade;
    if (grade === 'PERFECT' && Math.random() > this.preset.perfectRate) {
      grade = 'GOOD';
    }
    if (grade !== 'MISS' && Math.random() < this.preset.weakReturnRate) {
      grade = 'MISS';
    }

    let shotType = 'NORMAL';
    const isHighSmashBall = ballPhysics.position.y > 1.55 && this.position.z > -7.2;

    if (
      this.preset.allowSmash &&
      isHighSmashBall &&
      Math.random() < this.preset.smashChance
    ) {
      shotType = 'SMASH';
    } else if (
      playerPos &&
      playerPos.z < 5.5 &&
      Math.random() < this.preset.lobChance
    ) {
      shotType = 'LOB';
    } else if (grade !== 'MISS' && Math.random() < this.preset.powerShotChance) {
      shotType = 'POWER';
    }

    // Placement accuracy & shot scatter by difficulty
    const playerX = playerPos ? playerPos.x : 0;
    const openCourtDir = playerX >= 0 ? -1 : 1;
    const placementWeight = this.preset.placementAccuracy;
    const randomSpread = (Math.random() - 0.5) * 2 * this.preset.shotScatter;

    let aimX =
      openCourtDir * (0.28 + 0.52 * placementWeight) * (this.difficultyKey === 'easy' ? 0.55 : 1.0) +
      randomSpread * (1 - placementWeight * 0.55);
    aimX = Math.max(-0.9, Math.min(0.9, aimX));

    // Unforced OUT error chance (only on rally shots #2+ or stretched returns)
    const unforcedError =
      this.currentRallyHitCount >= 2 &&
      Math.random() < this.preset.unforcedErrorOutRate;

    return {
      shotType,
      aimX,
      aimZ: 0,
      grade,
      unforcedError
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
