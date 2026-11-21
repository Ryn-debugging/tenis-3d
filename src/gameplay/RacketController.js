/**
 * Default configurable timing and reach thresholds (PRD Section 9).
 */
export const DEFAULT_TIMING_CONFIG = {
  maxReachX: 2.75,
  maxReachZ: 2.65,
  maxReachY: 3.4,
  goodWindowX: 2.35,
  goodWindowZ: 2.05,
  perfectWindowX: 1.55,
  perfectWindowZ: 0.98,
  servePerfectApex: 2.3,
  servePerfectDelta: 0.36,
  serveGoodMinY: 1.35,
  serveGoodMaxY: 2.95,
  swingDuration: 0.3,
  activeStrikeDuration: 0.22
};

/**
 * RacketController
 * Handles racket swing animation states (serve, smash, forehand, backhand)
 * with windup anticipation and follow-through, active strike window buffering,
 * reach envelope validation, and configurable PERFECT / GOOD / MISS timing evaluation.
 */
export class RacketController {
  constructor(side = 'player', characterMesh, customConfig = {}) {
    this.side = side; // 'player' | 'ai'
    this.characterMesh = characterMesh;
    this.racketPivot = characterMesh?.userData?.racketPivot || null;

    this.config = {
      ...DEFAULT_TIMING_CONFIG,
      ...customConfig
    };

    this.isSwinging = false;
    this.swingTimer = 0;
    this.hasConnectedOnSwing = false;
    this.requestedShotType = 'NORMAL';
    this.swingHand = 'forehand'; // 'forehand' | 'backhand' | 'serve' | 'smash'
    this.poseOverride = null; // null | 'serve_toss' | 'win' | 'lose'
  }

  /**
   * Allows runtime tuning of timing thresholds for playtesting and balancing.
   */
  setTimingConfig(overrides = {}) {
    Object.assign(this.config, overrides);
  }

  setPoseOverride(pose = null) {
    this.poseOverride = pose;
  }

  /**
   * Starts a racket swing.
   * @param {'SERVE' | 'NORMAL' | 'POWER' | 'LOB' | 'SMASH'} shotType
   * @param {number} ballOffsetX relative X of ball from character
   * @param {number} ballY height of ball
   */
  startSwing(shotType = 'NORMAL', ballOffsetX = 0, ballY = 1.0) {
    if (this.isSwinging && this.swingTimer < this.config.swingDuration * 0.65) {
      return false;
    }

    this.isSwinging = true;
    this.swingTimer = 0;
    this.hasConnectedOnSwing = false;
    this.requestedShotType = shotType;
    this.poseOverride = null;

    if (shotType === 'SERVE') {
      this.swingHand = 'serve';
    } else if (shotType === 'SMASH' || ballY > 1.75) {
      this.swingHand = 'smash';
    } else {
      // For player (facing -Z), +X is forehand and -X is backhand
      const forehandDir = this.side === 'player' ? 1 : -1;
      this.swingHand =
        ballOffsetX * forehandDir >= -0.15 ? 'forehand' : 'backhand';
    }

    // Move pivot to the active side of the body
    if (this.racketPivot) {
      const baseX = this.side === 'player' ? 0.62 : -0.62;
      if (this.swingHand === 'backhand') {
        this.racketPivot.position.x = -baseX * 0.85;
      } else {
        this.racketPivot.position.x = baseX;
      }
    }

    return true;
  }

  /**
   * Evaluates whether the ball can be struck right now and grades timing quality:
   * - PERFECT: Ideal strike window
   * - GOOD: Acceptable strike window
   * - MISS (canHit: true): Early/late outer-edge clip producing a weak return
   * - MISS (canHit: false): Complete whiff / out of reach
   */
  evaluateContact(charPos, ballPhysics) {
    if (!ballPhysics.active) {
      return { canHit: false, grade: 'MISS', timingDetail: 'INACTIVE' };
    }

    // Handle active serve toss contact
    if (ballPhysics.isTossing) {
      if (ballPhysics.lastHitter !== this.side) {
        return { canHit: false, grade: 'MISS', timingDetail: 'WRONG_SERVER' };
      }
      const ballY = ballPhysics.position.y;
      if (ballY >= 1.05 && ballY <= 3.45) {
        const apexDelta = Math.abs(ballY - this.config.servePerfectApex);
        if (apexDelta <= this.config.servePerfectDelta) {
          return {
            canHit: true,
            grade: 'PERFECT',
            isServeHit: true,
            timingDetail: 'IDEAL_APEX'
          };
        }
        if (
          ballY >= this.config.serveGoodMinY &&
          ballY <= this.config.serveGoodMaxY
        ) {
          return {
            canHit: true,
            grade: 'GOOD',
            isServeHit: true,
            timingDetail: 'GOOD_TOSS'
          };
        }
        return {
          canHit: true,
          grade: 'MISS',
          isServeHit: true,
          timingDetail: 'MISTIMED_TOSS'
        };
      }
      return { canHit: false, grade: 'MISS', timingDetail: 'OUT_OF_TOSS_RANGE' };
    }

    // Prevent double-hitting own shot
    if (ballPhysics.lastHitter === this.side) {
      return { canHit: false, grade: 'MISS', timingDetail: 'ALREADY_HIT' };
    }

    // Ball must be on or entering this character's half of the court
    if (this.side === 'player' && ballPhysics.position.z < -0.3) {
      return { canHit: false, grade: 'MISS', timingDetail: 'OPPONENT_SIDE' };
    }
    if (this.side === 'ai' && ballPhysics.position.z > 0.3) {
      return { canHit: false, grade: 'MISS', timingDetail: 'OPPONENT_SIDE' };
    }

    // Ideal strike plane is slightly in front of the character toward the net
    const forwardDir = this.side === 'player' ? -1 : 1;
    const idealStrikeZ = charPos.z + forwardDir * 0.72;

    const dx = Math.abs(ballPhysics.position.x - charPos.x);
    const signedDz = (ballPhysics.position.z - idealStrikeZ) * forwardDir;
    const dz = Math.abs(ballPhysics.position.z - idealStrikeZ);
    const dy = ballPhysics.position.y;

    if (
      dx <= this.config.maxReachX &&
      dz <= this.config.maxReachZ &&
      dy <= this.config.maxReachY
    ) {
      if (dz <= this.config.perfectWindowZ && dx <= this.config.perfectWindowX) {
        return {
          canHit: true,
          grade: 'PERFECT',
          isServeHit: false,
          timingDetail: 'IDEAL'
        };
      }

      if (dz <= this.config.goodWindowZ && dx <= this.config.goodWindowX) {
        return {
          canHit: true,
          grade: 'GOOD',
          isServeHit: false,
          timingDetail: signedDz > 0 ? 'SLIGHTLY_EARLY' : 'SLIGHTLY_LATE'
        };
      }

      return {
        canHit: true,
        grade: 'MISS',
        isServeHit: false,
        timingDetail: signedDz > 0 ? 'TOO_EARLY' : 'TOO_LATE'
      };
    }

    return { canHit: false, grade: 'MISS', timingDetail: 'OUT_OF_REACH' };
  }

  updateAnimation(dt, animTime = 0) {
    if (!this.racketPivot) return;

    const dir = this.side === 'player' ? 1 : -1;

    if (!this.isSwinging) {
      if (this.poseOverride === 'serve_toss') {
        // Cocked back overhead anticipation during serve ball toss
        this.racketPivot.rotation.x +=
          (dir * 0.95 - this.racketPivot.rotation.x) * Math.min(1, dt * 14);
        this.racketPivot.rotation.y +=
          (dir * 0.35 - this.racketPivot.rotation.y) * Math.min(1, dt * 14);
        this.racketPivot.rotation.z +=
          (0 - this.racketPivot.rotation.z) * Math.min(1, dt * 14);
      } else if (this.poseOverride === 'win') {
        // Raised celebratory racket wave
        this.racketPivot.rotation.x = -dir * 0.45;
        this.racketPivot.rotation.z =
          dir * (0.35 + Math.sin(animTime * 12) * 0.35);
      } else if (this.poseOverride === 'lose') {
        // Drooping racket at side
        this.racketPivot.rotation.x = dir * 1.05;
        this.racketPivot.rotation.z = -dir * 0.55;
      } else {
        // Smoothly return racket pivot to ready stance
        this.racketPivot.rotation.x +=
          (0 - this.racketPivot.rotation.x) * Math.min(1, dt * 12);
        this.racketPivot.rotation.y +=
          (0 - this.racketPivot.rotation.y) * Math.min(1, dt * 12);
        this.racketPivot.rotation.z +=
          (0 - this.racketPivot.rotation.z) * Math.min(1, dt * 12);
      }
      return;
    }

    this.swingTimer += dt;
    const progress = Math.min(1.0, this.swingTimer / this.config.swingDuration);

    // 3-stage swing curve: Anticipation (0..0.22) -> Strike Whip (0.22..0.72) -> Follow-through (0.72..1.0)
    let swingPhase = 0;
    if (progress < 0.22) {
      // Wind-up coil back
      swingPhase = -(progress / 0.22) * 0.38;
    } else if (progress < 0.72) {
      const t = (progress - 0.22) / 0.5;
      swingPhase = -0.38 + t * 1.58;
    } else {
      const t = (progress - 0.72) / 0.28;
      swingPhase = 1.2 - t * 0.35;
    }

    const arc = Math.sin(progress * Math.PI);

    if (this.swingHand === 'serve' || this.swingHand === 'smash') {
      const forwardSign = this.side === 'player' ? -1 : 1;
      this.racketPivot.rotation.x = forwardSign * swingPhase * 1.75;
      this.racketPivot.rotation.y = dir * (progress - 0.5) * 0.55;
      this.racketPivot.rotation.z = 0;
    } else if (this.swingHand === 'backhand') {
      this.racketPivot.rotation.y = dir * (-0.95 + (swingPhase + 0.38) * 1.85);
      this.racketPivot.rotation.x = -arc * 0.55;
    } else {
      this.racketPivot.rotation.y = dir * (0.95 - (swingPhase + 0.38) * 1.85);
      this.racketPivot.rotation.x = -arc * 0.55;
    }

    if (this.swingTimer >= this.config.swingDuration) {
      this.isSwinging = false;
      this.hasConnectedOnSwing = false;
    }
  }
}
