import { COURT_CONFIG } from '../core/SceneManager.js';

/**
 * ShotSystem
 * Computes shot trajectory parameters (target landing spot, flight duration, gravity, spin)
 * based on shot type, timing quality (PERFECT / GOOD / MISS), aim input, and court position.
 */
export class ShotSystem {
  static SMASH_MIN_HEIGHT = 1.25;

  /**
   * Returns true only when the ball is in a valid high smash position for the given side.
   */
  static isValidSmashPosition(ballPhysics, side = 'player') {
    if (!ballPhysics || !ballPhysics.active || ballPhysics.isTossing || ballPhysics.blockedByNet) {
      return false;
    }
    if (ballPhysics.lastHitter === side) {
      return false;
    }
    const onCorrectSide =
      side === 'player' ? ballPhysics.position.z >= -0.4 : ballPhysics.position.z <= 0.4;
    if (!onCorrectSide) {
      return false;
    }
    return ballPhysics.position.y >= ShotSystem.SMASH_MIN_HEIGHT;
  }

  /**
   * Computes launch parameters for BallPhysics.launch().
   * Timing grades (PERFECT, GOOD, MISS) meaningfully affect speed, accuracy, and trajectory.
   */
  static computeShot({
    hitter = 'player',
    shotType = 'NORMAL',
    timingGrade = 'GOOD',
    aimX = 0,
    aimZ = 0,
    ballPos = { x: 0, y: 1.0, z: 10 },
    serveSide = 'deuce',
    unforcedError = false
  }) {
    const dirZ = hitter === 'player' ? -1 : 1; // Player hits toward -Z; AI hits toward +Z
    const isPerfect = timingGrade === 'PERFECT';
    const isMiss = timingGrade === 'MISS';

    // Handle SERVE trajectory into diagonal service box
    if (shotType === 'SERVE') {
      let targetX = 0;
      const aimSpread = isPerfect ? 1.45 : isMiss ? 0.5 : 1.15;
      if (hitter === 'player') {
        const boxCenter = serveSide === 'deuce' ? -2.7 : 2.7;
        targetX = boxCenter + aimX * aimSpread;
      } else {
        const boxCenter = serveSide === 'deuce' ? 2.7 : -2.7;
        targetX = boxCenter + aimX * aimSpread;
      }

      const depth = isPerfect ? 5.45 : isMiss ? 3.2 : 4.4;
      const targetZ = dirZ * depth;
      const flightTime = isPerfect ? 0.65 : isMiss ? 0.98 : 0.8;

      return {
        targetPos: { x: targetX, y: 0.23, z: targetZ },
        flightTime,
        gravity: isMiss ? 21.5 : 24.0,
        spinX: isPerfect ? aimX * 1.8 : 0,
        resolvedShotType: 'SERVE',
        timingGrade
      };
    }

    const effectiveShot = shotType;

    // Lateral target selection from aimX (-1..1), modulated by timing quality and fairness
    let maxSafeX = isPerfect
      ? COURT_CONFIG.PLAYABLE_HALF_WIDTH - 0.65
      : isMiss
      ? COURT_CONFIG.SINGLES_HALF_WIDTH - 1.4
      : COURT_CONFIG.SINGLES_HALF_WIDTH - 0.35;

    // Balance AI placement so player always has a fair chance to reach returns
    if (hitter === 'ai') {
      maxSafeX = Math.min(maxSafeX, 4.45);
    }

    let targetX = aimX * maxSafeX;

    // Early/late MISS-grade contact loses directional precision
    if (isMiss) {
      targetX = targetX * 0.45 + (aimX >= 0 ? 0.8 : -0.8);
    }

    // Realistic AI unforced error (slightly wide or long OUT ball)
    let outLongBonus = 0;
    if (hitter === 'ai' && unforcedError) {
      if (Math.abs(aimX) >= 0.35) {
        const sideSign = aimX >= 0 ? 1 : -1;
        targetX = sideSign * (COURT_CONFIG.PLAYABLE_HALF_WIDTH + 0.65);
      } else {
        outLongBonus = 2.6;
      }
    }

    let targetDepth = 9.0;
    let flightTime = 0.88;
    let gravity = 24.0;
    let spinX = 0;

    switch (effectiveShot) {
      case 'POWER': {
        targetDepth = isPerfect ? 10.65 : isMiss ? 6.5 : 9.65;
        flightTime = isPerfect ? 0.64 : isMiss ? 1.05 : 0.71;
        if (hitter === 'ai') {
          flightTime = Math.max(flightTime, 0.74);
        }
        gravity = isMiss ? 22.0 : 26.2;
        spinX = isMiss ? 0 : aimX * (isPerfect ? 2.6 : 1.3);
        break;
      }
      case 'LOB': {
        targetDepth = isPerfect ? 10.85 : isMiss ? 6.8 : 9.95;
        flightTime = isPerfect ? 1.28 : isMiss ? 1.44 : 1.34;
        gravity = 21.5;
        break;
      }
      case 'SMASH': {
        targetDepth = isPerfect ? 8.85 : isMiss ? 5.8 : 7.8;
        flightTime = isPerfect ? 0.48 : isMiss ? 0.85 : 0.56;
        if (hitter === 'ai') {
          flightTime = Math.max(flightTime, 0.62);
        }
        gravity = isMiss ? 23.0 : 28.0;
        break;
      }
      case 'NORMAL':
      default: {
        const depthOffset = -aimZ * 1.35;
        targetDepth = (isPerfect ? 10.05 : isMiss ? 5.8 : 8.75) + (isMiss ? 0 : depthOffset);
        targetDepth = Math.max(5.2, Math.min(11.0, targetDepth));
        flightTime = isPerfect ? 0.75 : isMiss ? 1.15 : 0.88;
        gravity = isMiss ? 21.5 : 24.0;
        spinX = isMiss ? 0 : aimX * (isPerfect ? 1.5 : 0.6);
        break;
      }
    }

    if (outLongBonus > 0) {
      targetDepth = Math.max(targetDepth + outLongBonus, COURT_CONFIG.HALF_LENGTH + 0.65);
    }

    // Ensure the trajectory clears the net at z = 0
    const distToNet = Math.abs(ballPos.z);
    const totalDistZ = Math.abs(dirZ * targetDepth - ballPos.z);
    if (totalDistZ > 0.5) {
      const tNet = flightTime * (distToNet / totalDistZ);
      const vyInitial =
        (0.23 - ballPos.y + 0.5 * gravity * flightTime * flightTime) / flightTime;
      const yAtNet = ballPos.y + vyInitial * tNet - 0.5 * gravity * tNet * tNet;
      const minNetClearance = COURT_CONFIG.NET_HEIGHT + 0.34;

      if (yAtNet < minNetClearance) {
        flightTime = Math.max(flightTime, 0.78);
      }
    }

    return {
      targetPos: {
        x: targetX,
        y: 0.23,
        z: dirZ * targetDepth
      },
      flightTime,
      gravity,
      spinX,
      resolvedShotType: effectiveShot,
      timingGrade
    };
  }
}
