import { PlayerController } from './PlayerController.js';
import { AIController } from './AIController.js';
import { BallController } from './BallController.js';
import { ShotSystem } from './ShotSystem.js';
import { TennisScoring } from './TennisScoring.js';
import { EffectManager } from '../effects/EffectManager.js';
import { MatchHUD } from '../ui/MatchHUD.js';

/**
 * MatchManager
 * Orchestrates the 3D tennis match loop: serve setup, toss, rally exchanges,
 * configurable timing outcomes (PERFECT! / GOOD! / MISS!), Power Energy system,
 * arcade scoring (First to 7, Win by 2, Best of 3), 3D EffectManager & ParticleManager,
 * character animation states, MatchHUD updates, and match completion callbacks.
 */
export class MatchManager {
  constructor(
    sceneManager,
    cameraManager,
    assetManager,
    inputManager,
    callbacks = {}
  ) {
    this.sceneManager = sceneManager;
    this.cameraManager = cameraManager;
    this.assetManager = assetManager;
    this.inputManager = inputManager;
    this.onMatchComplete = callbacks.onMatchComplete || null;
    this.audioManager = callbacks.audioManager || null;

    this.scoring = new TennisScoring({
      pointsToWinRound: 7,
      winByMargin: 2,
      roundsToWinMatch: 2
    });

    // Power Energy configuration (Phase 3)
    this.energyConfig = {
      maxEnergy: 100,
      powerShotCost: 40,
      regenRatePerSec: 8.5,
      perfectRallyBonus: 22,
      goodRallyBonus: 12,
      pointRecoveryBonus: 15
    };
    this.playerEnergy = this.energyConfig.maxEnergy;
    this.energyAlertTimer = 0;

    // Match performance statistics for ResultsScreen
    this.stats = {
      perfectShots: 0,
      aces: 0,
      totalPlayerPoints: 0
    };

    this.hud = new MatchHUD();
    this.ui = this.hud.elements;

    this.effects = new EffectManager(this.sceneManager.scene, this.assetManager);
    this.player = new PlayerController(
      this.sceneManager.scene,
      this.assetManager,
      'angel'
    );
    this.ai = new AIController(
      this.sceneManager.scene,
      this.assetManager,
      'normal'
    );

    this.ball = new BallController(this.sceneManager.scene, this.assetManager, {
      onBounce: (info) => this.handleBallBounce(info),
      onNetHit: (info) => this.handleNetHit(info),
      onServeTossDropped: (server) => this.handleServeTossDropped(server)
    });

    this.state = 'SERVE_WAIT'; // 'SERVE_WAIT' | 'SERVE_TOSS' | 'RALLY' | 'POINT_OVER' | 'MATCH_OVER'
    this.stateTimer = 0;
    this.rallyHitCount = 0;
    this.firstBounceWasIn = false;
    this.pendingPlayerShotType = null;
    this.shotGradeBannerTimer = 0;

    this.hud.setPlayerProfile(this.player.characterProfile);
    this.hud.setDifficultyLabel(this.ai.difficultyKey);
    this.setupPoint(true);
  }

  selectCharacter(characterId = 'angel') {
    const profile = this.player.setCharacter(characterId);
    this.hud.setPlayerProfile(profile);
    return profile;
  }

  selectDifficulty(level = 'normal') {
    this.ai.setDifficulty(level);
    this.hud.setDifficultyLabel(this.ai.difficultyKey);
  }

  restartMatch() {
    this.scoring.resetMatch();
    this.playerEnergy = this.energyConfig.maxEnergy;
    this.stats.perfectShots = 0;
    this.stats.aces = 0;
    this.stats.totalPlayerPoints = 0;
    if (this.inputManager) {
      this.inputManager.resetAllInput();
    }
    if (this.effects && this.effects.particles) {
      this.effects.particles.clearAll();
    }
    const resultsModal = document.getElementById('results-modal');
    if (resultsModal) {
      resultsModal.classList.add('hidden');
    }
    this.setupPoint(true);
  }

  isSmashValid() {
    return (
      this.state === 'RALLY' &&
      ShotSystem.isValidSmashPosition(this.ball.physics, 'player')
    );
  }

  isPowerShotAvailable() {
    return this.playerEnergy >= this.energyConfig.powerShotCost;
  }

  addEnergy(amount) {
    this.playerEnergy = Math.max(
      0,
      Math.min(this.energyConfig.maxEnergy, this.playerEnergy + amount)
    );
    this.updateEnergyHud();
  }

  triggerInsufficientEnergyFeedback() {
    this.energyAlertTimer = 0.65;
    this.hud.flashInsufficientEnergy();
    this.showShotGrade('LOW_ENERGY');
    this.setPrompt(
      `Need <strong>${this.energyConfig.powerShotCost}% ENERGY</strong> for POWER Shot — Rally to Recharge!`
    );
  }

  setupPoint(isMatchStart = false) {
    if (!isMatchStart) {
      this.addEnergy(this.energyConfig.pointRecoveryBonus);
    } else {
      this.updateEnergyHud();
    }

    const scoreState = this.scoring.getState();
    const serveSide = scoreState.serveSide;
    const isPlayerServing = scoreState.server === 'player';

    this.state = 'SERVE_WAIT';
    this.stateTimer = 0;
    this.rallyHitCount = 0;
    this.firstBounceWasIn = false;
    this.pendingPlayerShotType = null;

    this.player.canMove = !isPlayerServing;
    this.player.setServePosition(serveSide, isPlayerServing);
    this.ai.setServePosition(serveSide, !isPlayerServing);

    // Place ball next to the current server
    this.ball.clearTrail();
    if (isPlayerServing) {
      this.ball.physics.resetAt(
        this.player.position.x + 0.45,
        1.05,
        this.player.position.z - 0.35
      );
    } else {
      this.ball.physics.resetAt(
        this.ai.position.x - 0.45,
        1.05,
        this.ai.position.z + 0.35
      );
    }

    this.hidePointBanner();
    this.updateScoreHud();
    this.updateSituationAlert(scoreState);

    if (scoreState.isMatchPoint) {
      this.showShotGrade('MATCH_POINT');
    }

    if (isPlayerServing) {
      this.setPrompt('Tap <strong>SERVE</strong> or Press <kbd>SPACE</kbd> to Toss &amp; Serve');
    } else {
      this.setPrompt('Opponent Duck is preparing to serve...');
    }

    this.syncTouchControls();
  }

  updateSituationAlert(scoreState) {
    const shortName = this.player.characterProfile?.shortName || 'ANGEL';
    this.hud.updateSituationAlert(scoreState, shortName);
  }

  syncTouchControls() {
    this.updateEnergyHud();
    if (this.inputManager && this.inputManager.updateTouchContext) {
      this.inputManager.updateTouchContext({
        matchState: this.state,
        isPlayerServing: this.scoring.server === 'player',
        isSmashReady: this.isSmashValid(),
        isPowerReady: this.isPowerShotAvailable()
      });
    }
  }

  triggerServeToss(server) {
    if (this.state !== 'SERVE_WAIT') return;
    this.state = 'SERVE_TOSS';
    this.stateTimer = 0;

    if (this.audioManager) {
      this.audioManager.play('serveToss');
    }

    if (server === 'player') {
      this.ball.physics.startServeToss(
        this.player.position.x + 0.45,
        1.15,
        this.player.position.z - 0.45,
        'player'
      );
      this.setPrompt('Tap <strong>STRIKE!</strong> or Press <kbd>SPACE</kbd> at the apex for a PERFECT! Serve');
    } else {
      this.ball.physics.startServeToss(
        this.ai.position.x - 0.45,
        1.15,
        this.ai.position.z + 0.45,
        'ai'
      );
      this.setPrompt('Get Ready to Return!');
    }
  }

  executeShot({ hitter, shotType, aimX, aimZ, timingGrade, unforcedError = false }) {
    const ballPos = { ...this.ball.physics.position };
    const serveSide = this.scoring.getServeSide();

    // Manage Player Power Energy consumption and rally regeneration
    if (hitter === 'player') {
      if (timingGrade === 'PERFECT') {
        this.stats.perfectShots += 1;
      }
      if (shotType === 'POWER') {
        this.addEnergy(-this.energyConfig.powerShotCost);
      } else if (timingGrade === 'PERFECT') {
        this.addEnergy(this.energyConfig.perfectRallyBonus);
      } else if (timingGrade === 'GOOD') {
        this.addEnergy(this.energyConfig.goodRallyBonus);
      }
      this.player.triggerHitRecoil();
    } else {
      this.ai.triggerHitRecoil();
    }

    const shotParams = ShotSystem.computeShot({
      hitter,
      shotType,
      timingGrade,
      aimX,
      aimZ,
      ballPos,
      serveSide,
      unforcedError
    });

    this.firstBounceWasIn = false;
    this.rallyHitCount += 1;

    this.ball.physics.launch(ballPos, shotParams.targetPos, shotParams.flightTime, {
      gravity: shotParams.gravity,
      spinX: shotParams.spinX,
      hitter,
      shotType: shotParams.resolvedShotType,
      shotGrade: timingGrade,
      isServe: shotType === 'SERVE',
      serveTargetSide: serveSide
    });

    this.ball.setShotVisualStyle(timingGrade, shotParams.resolvedShotType);

    if (this.audioManager) {
      this.audioManager.playRacketImpact(
        shotParams.resolvedShotType,
        timingGrade
      );
    }

    const hitterPos =
      hitter === 'player' ? this.player.position : this.ai.position;
    this.effects.onRacketHit(
      ballPos,
      hitterPos,
      timingGrade,
      shotParams.resolvedShotType
    );

    if (
      timingGrade === 'PERFECT' ||
      shotParams.resolvedShotType === 'POWER' ||
      shotParams.resolvedShotType === 'SMASH'
    ) {
      const isSmash = shotParams.resolvedShotType === 'SMASH';
      const isPower = shotParams.resolvedShotType === 'POWER';
      this.cameraManager.triggerShake(
        isSmash ? 0.24 : isPower ? 0.17 : 0.12,
        0.16,
        isSmash ? -1.1 : isPower ? -0.85 : -0.55
      );
    }

    if (hitter === 'player') {
      this.showShotGrade(timingGrade, shotParams.resolvedShotType);
      this.ai.notifyPlayerHitBall({ rallyHitCount: this.rallyHitCount });
      this.player.canMove = true;
    }

    this.state = 'RALLY';
    this.setPrompt(
      hitter === 'player'
        ? 'Rally Active — Use Joystick to position for the return!'
        : 'Incoming Ball — Tap <strong>HIT</strong> / <strong>POWER</strong> / <strong>LOB</strong> / <strong>SMASH</strong>!'
    );
  }

  handleServeTossDropped() {
    if (this.state !== 'SERVE_TOSS') return;
    this.setupPoint();
  }

  handleNetHit(info) {
    if (this.state !== 'RALLY') return;
    if (this.audioManager) {
      this.audioManager.play('netHit');
    }
    if (info.type === 'CORD_CLIP') {
      this.setPrompt('NET CORD! Ball clipped the top tape...');
    }
  }

  handleBallBounce(info) {
    if (this.state !== 'RALLY') return;

    if (this.audioManager) {
      this.audioManager.play('ballBounce');
    }
    this.effects.onBallBounce({ x: info.x, z: info.z }, info.isIn);

    const { bounceCount, isIn, reason, hitter, blockedByNet } = info;
    const opponent = hitter === 'player' ? 'ai' : 'player';

    if (bounceCount === 1) {
      if (!isIn) {
        let callout = 'OUT';
        if (blockedByNet || reason === 'OWN_SIDE_FAULT') {
          callout = 'NET FAULT';
        } else if (reason === 'SERVE_FAULT') {
          callout = 'SERVE FAULT';
        }
        this.endPoint(opponent, callout, false);
      } else {
        this.firstBounceWasIn = true;
      }
    } else if (bounceCount >= 2) {
      if (this.firstBounceWasIn) {
        const isAce = this.rallyHitCount === 1;
        this.endPoint(hitter, isAce ? 'ACE!' : 'DOUBLE BOUNCE', isAce);
      } else {
        this.endPoint(opponent, 'OUT', false);
      }
    }
  }

  endPoint(winner, reasonLabel, isAce = false) {
    if (this.state === 'POINT_OVER' || this.state === 'MATCH_OVER') return;

    if (winner === 'player') {
      this.stats.totalPlayerPoints += 1;
      if (isAce || reasonLabel === 'ACE!') {
        this.stats.aces += 1;
      }
    }

    const completedRoundNumber = this.scoring.currentRound;
    const result = this.scoring.awardPoint(winner);
    this.updateScoreHud(winner, result.roundEnded);
    this.updateSituationAlert(this.scoring.getState());

    const playerShortName = this.player.characterProfile?.shortName || 'ANGEL';
    const winnerName = winner === 'player' ? playerShortName : 'DUCK AI';

    // Trigger win / lose character animations and celebration particles
    if (winner === 'player') {
      this.player.setAnimState('win');
      this.ai.setAnimState('lose');
      this.effects.onPointCelebration(
        this.player.position,
        result.matchEnded || result.roundEnded
      );
    } else {
      this.ai.setAnimState('win');
      this.player.setAnimState('lose');
      this.effects.onPointCelebration(
        this.ai.position,
        result.matchEnded || result.roundEnded
      );
    }

    if (result.matchEnded) {
      this.state = 'MATCH_OVER';
      this.stateTimer = 0;
      const outcomeHeadline = winner === 'player' ? 'VICTORY!' : 'DEFEAT!';
      this.showPointBanner(`${outcomeHeadline} &bull; ${winnerName} WINS THE MATCH!`);
      this.showShotGrade(winner === 'player' ? 'VICTORY' : 'DEFEAT');
      this.setPrompt('Match Complete! Tap <strong>REMATCH</strong> or Press <kbd>SPACE</kbd> to Play Again');

      if (this.audioManager) {
        this.audioManager.play(winner === 'player' ? 'victory' : 'defeat');
      }

      if (this.onMatchComplete) {
        const finalState = this.scoring.getState();
        this.onMatchComplete({
          winner,
          difficulty: this.ai.difficultyKey,
          playerName: playerShortName,
          playerRounds: finalState.playerRounds,
          aiRounds: finalState.aiRounds,
          roundHistory: finalState.roundHistory,
          stats: { ...this.stats }
        });
      }
    } else if (result.roundEnded) {
      this.state = 'POINT_OVER';
      this.stateTimer = 2.25;
      this.showPointBanner(`GAME! &bull; ${winnerName} WINS ROUND ${completedRoundNumber}!`);
      this.showShotGrade('GAME');
      this.setPrompt(`Round ${completedRoundNumber} Complete — Preparing Round ${this.scoring.currentRound}...`);
      if (this.audioManager) {
        this.audioManager.play('point');
      }
    } else {
      this.state = 'POINT_OVER';
      this.stateTimer = 1.65;
      if (isAce || reasonLabel === 'ACE!') {
        this.showPointBanner(`ACE! &bull; POINT! ${winnerName}`);
        this.showShotGrade('ACE');
        if (this.audioManager) {
          this.audioManager.play('ace');
        }
      } else {
        this.showPointBanner(`POINT! &bull; ${winnerName} (${reasonLabel})`);
        if (this.audioManager) {
          this.audioManager.play('point');
        }
      }
      this.setPrompt('Next point starting...');
    }
  }

  stepPhysics(fixedDt) {
    this.inputManager.update();
    const requestedShot = this.inputManager.consumeShotRequest();

    // Passive energy regeneration during active rally
    if (this.state === 'RALLY') {
      this.addEnergy(this.energyConfig.regenRatePerSec * fixedDt);
    }

    this.ball.stepPhysics(fixedDt);

    // Check if ball exits playable apron after bouncing once, or flies far out of bounds unbounced
    if (this.state === 'RALLY' && this.ball.physics.active && !this.ball.physics.isTossing) {
      const { x, z } = this.ball.physics.position;
      const pastPlayableApron =
        this.ball.physics.bounceCount >= 1 && (Math.abs(z) > 15.2 || Math.abs(x) > 10.6);
      const farOutOfStadium = Math.abs(z) > 20 || Math.abs(x) > 17;

      if (pastPlayableApron || farOutOfStadium) {
        const hitter = this.ball.physics.lastHitter;
        const opponent = hitter === 'player' ? 'ai' : 'player';
        if (this.firstBounceWasIn) {
          const isAce = this.rallyHitCount === 1;
          this.endPoint(hitter, isAce ? 'ACE!' : 'WINNER', isAce);
        } else {
          this.endPoint(opponent, 'OUT', false);
        }
      }
    }

    // State Machine Handling at 120Hz fixed step
    if (this.state === 'MATCH_OVER') {
      if (
        requestedShot &&
        requestedShot !== 'SMASH_INVALID' &&
        requestedShot !== 'POWER_LOW_ENERGY'
      ) {
        this.restartMatch();
      }
    } else if (this.state === 'POINT_OVER') {
      this.stateTimer -= fixedDt;
      if (this.stateTimer <= 0) {
        this.setupPoint();
      }
    } else if (this.state === 'SERVE_WAIT') {
      const isPlayerServing = this.scoring.server === 'player';
      if (isPlayerServing) {
        if (requestedShot === 'SERVE' || requestedShot === 'NORMAL') {
          this.triggerServeToss('player');
        }
      } else {
        this.stateTimer += fixedDt;
        if (this.stateTimer >= 0.85) {
          this.triggerServeToss('ai');
        }
      }
    } else if (this.state === 'SERVE_TOSS') {
      const isPlayerServing = this.scoring.server === 'player';
      if (isPlayerServing) {
        const bp = this.ball.physics;
        const isServeInput = requestedShot === 'SERVE' || requestedShot === 'NORMAL';
        const reachedApex = bp.velocity.y <= 0.6 && bp.position.y >= 1.5;

        if (isServeInput || reachedApex) {
          const contact = this.player.racket.evaluateContact(
            this.player.position,
            this.ball.physics
          );
          if (contact.canHit) {
            this.player.racket.startSwing('SERVE', 0, bp.position.y);
            this.executeShot({
              hitter: 'player',
              shotType: 'SERVE',
              aimX: this.inputManager.moveX,
              aimZ: this.inputManager.moveZ,
              timingGrade: isServeInput ? contact.grade : 'GOOD'
            });
          }
        }
      }
    } else if (this.state === 'RALLY') {
      // Handle Player Swing Request
      if (requestedShot) {
        if (requestedShot === 'SMASH_INVALID' || (requestedShot === 'SMASH' && !this.isSmashValid())) {
          this.setPrompt('Ball is too low — wait for a high ball to <strong>SMASH</strong>!');
        } else if (
          requestedShot === 'POWER_LOW_ENERGY' ||
          (requestedShot === 'POWER' && !this.isPowerShotAvailable())
        ) {
          this.triggerInsufficientEnergyFeedback();
        } else {
          const resolvedRequest = requestedShot === 'SERVE' ? 'NORMAL' : requestedShot;
          const offsetX = this.ball.physics.position.x - this.player.position.x;
          this.player.racket.startSwing(
            resolvedRequest,
            offsetX,
            this.ball.physics.position.y
          );
          this.pendingPlayerShotType = resolvedRequest;
        }
      }

      // Evaluate Player Active Swing Window against Ball
      if (
        this.player.racket.isSwinging &&
        !this.player.racket.hasConnectedOnSwing &&
        this.player.racket.swingTimer <= this.player.racket.config.activeStrikeDuration
      ) {
        const shotType = this.pendingPlayerShotType || 'NORMAL';
        const smashAllowed = shotType !== 'SMASH' || this.isSmashValid();

        if (smashAllowed) {
          const contact = this.player.racket.evaluateContact(
            this.player.position,
            this.ball.physics
          );
          if (contact.canHit) {
            const isCleanWindow = contact.grade === 'PERFECT' || contact.grade === 'GOOD';
            const isLateOrExpiringSwing =
              contact.timingDetail === 'TOO_LATE' ||
              this.player.racket.swingTimer >=
                this.player.racket.config.activeStrikeDuration * 0.72;

            if (isCleanWindow || isLateOrExpiringSwing) {
              this.player.racket.hasConnectedOnSwing = true;
              this.pendingPlayerShotType = null;
              this.executeShot({
                hitter: 'player',
                shotType,
                aimX: this.inputManager.moveX,
                aimZ: this.inputManager.moveZ,
                timingGrade: contact.grade
              });
            }
          }
        }
      } else if (
        this.player.racket.isSwinging &&
        !this.player.racket.hasConnectedOnSwing &&
        this.player.racket.swingTimer > this.player.racket.config.activeStrikeDuration &&
        this.pendingPlayerShotType
      ) {
        this.pendingPlayerShotType = null;
        this.showShotGrade('MISS', 'NORMAL');
      }
    }

    // Update Player & AI Controllers at fixedDt
    this.player.update(fixedDt, this.inputManager, this.ball.physics);
    const aiShot = this.ai.update(fixedDt, this.ball.physics, this.player.position);

    const playerSpeed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    const aiSpeed = Math.hypot(this.ai.velocity.x, this.ai.velocity.z);
    this.effects.onCharacterMove('player', this.player.position, playerSpeed, fixedDt);
    this.effects.onCharacterMove('ai', this.ai.position, aiSpeed, fixedDt);

    if (aiShot && (this.state === 'RALLY' || this.state === 'SERVE_TOSS')) {
      this.executeShot({
        hitter: 'ai',
        shotType: aiShot.shotType,
        aimX: aiShot.aimX,
        aimZ: aiShot.aimZ,
        timingGrade: aiShot.grade,
        unforcedError: Boolean(aiShot.unforcedError)
      });
    }
  }

  update(dt, elapsedTime) {
    if (this.shotGradeBannerTimer > 0) {
      this.shotGradeBannerTimer = Math.max(0, this.shotGradeBannerTimer - dt);
      if (this.shotGradeBannerTimer === 0) {
        this.hud.hideShotGrade();
      }
    }

    if (this.energyAlertTimer > 0) {
      this.energyAlertTimer = Math.max(0, this.energyAlertTimer - dt);
      if (this.energyAlertTimer === 0) {
        this.hud.clearInsufficientEnergyFlash();
      }
    }

    this.syncTouchControls();
    this.ball.updateVisuals(elapsedTime, dt);
    this.effects.update(dt);
  }

  showShotGrade(grade = 'GOOD', shotType = 'NORMAL') {
    this.hud.showShotGrade(grade, shotType);
    this.shotGradeBannerTimer = 0.95;
  }

  showPointBanner(htmlText) {
    this.hud.showPointBanner(htmlText);
  }

  hidePointBanner() {
    this.hud.hidePointBanner();
  }

  setPrompt(htmlText) {
    this.hud.setPrompt(htmlText);
  }

  updateEnergyHud() {
    this.hud.updateEnergy(this.playerEnergy, this.isPowerShotAvailable());
  }

  updateScoreHud(animatedWinner = null, roundEnded = false) {
    this.hud.updateScore(this.scoring.getState(), animatedWinner, roundEnded);
    this.updateEnergyHud();
  }
}
