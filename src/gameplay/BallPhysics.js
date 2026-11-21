import { COURT_CONFIG } from '../core/SceneManager.js';

/**
 * Solves initial velocity vector (vx, vy, vz) to travel from startPos to targetPos
 * in flightTime seconds under constant downward gravity and optional lateral curve spinX.
 */
export function solveBallisticVelocity(
  startPos,
  targetPos,
  flightTime,
  gravity = 24.0,
  spinX = 0
) {
  const t = Math.max(flightTime, 0.15);
  const vx = (targetPos.x - startPos.x - 0.5 * spinX * t * t) / t;
  const vz = (targetPos.z - startPos.z) / t;
  const vy = (targetPos.y - startPos.y + 0.5 * gravity * t * t) / t;
  return { vx, vy, vz };
}

/**
 * BallPhysics
 * Frame-rate independent 3D tennis ball kinematics, swept net collision,
 * bounce & line legality checks, and trajectory prediction for AI.
 */
export class BallPhysics {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;

    this.radius = 0.23;
    this.gravity = 24.0;
    this.restitution = 0.72;
    this.groundFriction = 0.84;

    this.position = { x: 0, y: 1.0, z: 11.5 };
    this.prevPosition = { x: 0, y: 1.0, z: 11.5 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.spinX = 0;

    this.active = false;
    this.isTossing = false;
    this.lastHitter = null; // 'player' | 'ai'
    this.shotType = 'NORMAL';
    this.shotGrade = 'GOOD';
    this.isServeShot = false;
    this.serveTargetSide = 'deuce'; // 'deuce' | 'ad'
    this.bounceCount = 0;
    this.hasCrossedNet = false;
    this.blockedByNet = false;
  }

  resetAt(x, y, z) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    this.prevPosition.x = x;
    this.prevPosition.y = y;
    this.prevPosition.z = z;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
    this.spinX = 0;
    this.active = false;
    this.isTossing = false;
    this.bounceCount = 0;
    this.hasCrossedNet = false;
    this.blockedByNet = false;
  }

  startServeToss(x, y, z, hitter) {
    this.resetAt(x, y, z);
    this.active = true;
    this.isTossing = true;
    this.lastHitter = hitter;
    this.velocity.x = 0;
    this.velocity.y = 7.4; // Upward serve toss
    this.velocity.z = 0;
  }

  launch(startPos, targetPos, flightTime, options = {}) {
    this.position.x = startPos.x;
    this.position.y = startPos.y;
    this.position.z = startPos.z;
    this.prevPosition.x = startPos.x;
    this.prevPosition.y = startPos.y;
    this.prevPosition.z = startPos.z;

    this.gravity = options.gravity ?? 24.0;
    this.spinX = options.spinX ?? 0;
    this.lastHitter = options.hitter ?? 'player';
    this.shotType = options.shotType ?? 'NORMAL';
    this.shotGrade = options.shotGrade ?? 'GOOD';
    this.isServeShot = Boolean(options.isServe);
    this.serveTargetSide = options.serveTargetSide ?? 'deuce';

    this.bounceCount = 0;
    this.hasCrossedNet = false;
    this.blockedByNet = false;
    this.isTossing = false;
    this.active = true;

    const targetWithRadius = {
      x: targetPos.x,
      y: this.radius,
      z: targetPos.z
    };

    const solved = solveBallisticVelocity(
      this.position,
      targetWithRadius,
      flightTime,
      this.gravity,
      this.spinX
    );

    this.velocity.x = solved.vx;
    this.velocity.y = solved.vy;
    this.velocity.z = solved.vz;
  }

  /**
   * Evaluates whether a bounce coordinate (x, z) is legally IN bounds
   * for the active shot (service box for a serve, full playable court for a rally).
   */
  checkBounceLegality(x, z) {
    // Line tolerance: a ball touching the outer edge of a line is IN
    const lineTol = COURT_CONFIG.LINE_WIDTH * 0.5 + this.radius * 0.45;
    const expectedSide = this.lastHitter === 'player' ? 'ai' : 'player';
    const bounceSide = z < 0 ? 'ai' : 'player';

    // Bouncing on the hitter's own side of the net is always a fault
    if (bounceSide !== expectedSide) {
      return { isIn: false, reason: 'OWN_SIDE_FAULT' };
    }

    if (this.isServeShot && this.bounceCount === 1) {
      // Serve must land within the diagonal service box
      const zMin = expectedSide === 'ai' ? -(COURT_CONFIG.SERVICE_LINE_Z + lineTol) : 0;
      const zMax = expectedSide === 'ai' ? 0 : COURT_CONFIG.SERVICE_LINE_Z + lineTol;

      let xMin = -(COURT_CONFIG.SINGLES_HALF_WIDTH + lineTol);
      let xMax = COURT_CONFIG.SINGLES_HALF_WIDTH + lineTol;

      if (this.serveTargetSide === 'deuce') {
        // Player serving from right (+x) aims at AI left (-x); AI serving from left (-x) aims at Player right (+x)
        if (expectedSide === 'ai') {
          xMin = -(COURT_CONFIG.SINGLES_HALF_WIDTH + lineTol);
          xMax = lineTol;
        } else {
          xMin = -lineTol;
          xMax = COURT_CONFIG.SINGLES_HALF_WIDTH + lineTol;
        }
      } else {
        // Ad court serve
        if (expectedSide === 'ai') {
          xMin = -lineTol;
          xMax = COURT_CONFIG.SINGLES_HALF_WIDTH + lineTol;
        } else {
          xMin = -(COURT_CONFIG.SINGLES_HALF_WIDTH + lineTol);
          xMax = lineTol;
        }
      }

      const inServiceBox = x >= xMin && x <= xMax && z >= zMin && z <= zMax;
      return {
        isIn: inServiceBox,
        reason: inServiceBox ? 'IN' : 'SERVE_FAULT'
      };
    }

    // Standard rally shot: must land inside the opponent's half within outer playable sidelines
    const maxW = COURT_CONFIG.PLAYABLE_HALF_WIDTH + lineTol;
    const maxL = COURT_CONFIG.HALF_LENGTH + lineTol;

    const inWidth = Math.abs(x) <= maxW;
    const inDepth =
      expectedSide === 'ai'
        ? z <= 0 && z >= -maxL
        : z >= 0 && z <= maxL;

    return {
      isIn: inWidth && inDepth,
      reason: inWidth && inDepth ? 'IN' : 'OUT'
    };
  }

  /**
   * Predicts where the ball will next bounce and where it will be at ideal strike height
   * after the bounce. Used by AIController and visual court indicators.
   */
  predictLanding() {
    if (!this.active || this.isTossing) {
      return null;
    }

    // Solve y(t) = y0 + vy * t - 0.5 * g * t^2 = radius for t > 0
    const y0 = this.position.y;
    const vy = this.velocity.y;
    const g = this.gravity;
    const r = this.radius;

    const a = 0.5 * g;
    const b = -vy;
    const c = r - y0;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      return null;
    }

    const sqrtD = Math.sqrt(discriminant);
    let tBounce = (-b + sqrtD) / (2 * a);
    if (tBounce < 0.001) {
      tBounce = 0.001;
    }

    const bounceX =
      this.position.x +
      this.velocity.x * tBounce +
      0.5 * this.spinX * tBounce * tBounce;
    const bounceZ = this.position.z + this.velocity.z * tBounce;

    // Velocity right after first bounce
    const vyAfter = Math.abs(vy - g * tBounce) * this.restitution;
    const vxAfter = (this.velocity.x + this.spinX * tBounce) * this.groundFriction;
    const vzAfter = this.velocity.z * this.groundFriction;

    // Ideal strike point is ~0.26s after the bounce (comfortable waist/chest height)
    const strikeDelay = Math.min(0.32, Math.max(0.14, (vyAfter / g) * 0.85));
    const strikeX = bounceX + vxAfter * strikeDelay;
    const strikeZ = bounceZ + vzAfter * strikeDelay;
    const strikeY =
      r + vyAfter * strikeDelay - 0.5 * g * strikeDelay * strikeDelay;

    return {
      bounceX,
      bounceZ,
      timeToBounce: tBounce,
      strikeX,
      strikeY: Math.max(r, strikeY),
      strikeZ,
      timeToStrike: tBounce + strikeDelay
    };
  }

  /**
   * Advances ball physics by one fixed substep dt (e.g. 1/120s).
   */
  step(dt) {
    if (!this.active) return;

    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;
    this.prevPosition.z = this.position.z;

    // Integrate velocity & position
    if (!this.isTossing) {
      this.velocity.x += this.spinX * dt;
    }
    this.velocity.y -= this.gravity * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Handle serve toss drop without hit
    if (this.isTossing) {
      if (this.position.y <= this.radius && this.velocity.y < 0) {
        this.position.y = this.radius;
        this.isTossing = false;
        this.active = false;
        if (this.callbacks.onServeTossDropped) {
          this.callbacks.onServeTossDropped(this.lastHitter);
        }
      }
      return;
    }

    // 1. Continuous Swept Net Plane Intersection (z = 0)
    const prevZ = this.prevPosition.z;
    const currZ = this.position.z;
    if ((prevZ > 0 && currZ <= 0) || (prevZ < 0 && currZ >= 0)) {
      const dz = currZ - prevZ;
      const alpha = Math.abs(dz) > 1e-6 ? Math.abs(prevZ) / Math.abs(dz) : 0.5;
      const crossX =
        this.prevPosition.x + (this.position.x - this.prevPosition.x) * alpha;
      const crossY =
        this.prevPosition.y + (this.position.y - this.prevPosition.y) * alpha;

      const withinPosts = Math.abs(crossX) <= COURT_CONFIG.NET_POST_X;
      const netTop = COURT_CONFIG.NET_HEIGHT;

      if (withinPosts && crossY - this.radius < netTop) {
        if (crossY >= netTop - 0.09) {
          // Net cord clip: ball rolls over the top tape with reduced velocity
          this.velocity.z *= 0.55;
          this.velocity.x *= 0.75;
          this.velocity.y = Math.max(this.velocity.y * 0.5, 2.8);
          this.position.y = netTop + this.radius;
          this.hasCrossedNet = true;
          if (this.callbacks.onNetHit) {
            this.callbacks.onNetHit({
              type: 'CORD_CLIP',
              x: crossX,
              y: crossY
            });
          }
        } else {
          // Solid net block: ball rebounds onto hitter's side
          this.position.z = prevZ > 0 ? this.radius + 0.03 : -(this.radius + 0.03);
          this.velocity.z = -this.velocity.z * 0.22;
          this.velocity.x *= 0.45;
          this.velocity.y = Math.min(this.velocity.y * 0.4, 0.8);
          this.spinX = 0;
          this.blockedByNet = true;
          if (this.callbacks.onNetHit) {
            this.callbacks.onNetHit({
              type: 'NET_BLOCK',
              x: crossX,
              y: crossY
            });
          }
        }
      } else {
        this.hasCrossedNet = true;
      }
    }

    // 2. Ground Clay Bounce Check
    if (this.position.y <= this.radius && this.velocity.y < 0) {
      this.position.y = this.radius;
      this.velocity.y = Math.abs(this.velocity.y) * this.restitution;
      this.velocity.x *= this.groundFriction;
      this.velocity.z *= this.groundFriction;
      this.spinX *= 0.45;

      // Stop micro-bouncing once vertical energy is spent
      if (this.velocity.y < 1.1) {
        this.velocity.y = 0;
      }

      this.bounceCount += 1;
      const legality = this.checkBounceLegality(this.position.x, this.position.z);

      if (this.callbacks.onBounce) {
        this.callbacks.onBounce({
          x: this.position.x,
          z: this.position.z,
          bounceCount: this.bounceCount,
          isIn: legality.isIn,
          reason: legality.reason,
          hitter: this.lastHitter,
          blockedByNet: this.blockedByNet
        });
      }
    }
  }
}
