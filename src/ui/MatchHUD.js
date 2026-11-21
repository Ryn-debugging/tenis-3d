/**
 * MatchHUD
 * Modular controller for all in-match HUD overlay elements:
 * player/AI badges, scores, rounds, power energy meter, situation alerts,
 * timing callout banners, and action prompts.
 */
export class MatchHUD {
  constructor() {
    this.elements = {
      playerBadge: document.getElementById('hud-player-badge'),
      aiBadge: document.getElementById('hud-ai-badge'),
      playerPoints: document.getElementById('hud-player-points'),
      aiPoints: document.getElementById('hud-ai-points'),
      playerRounds: document.getElementById('hud-player-rounds'),
      aiRounds: document.getElementById('hud-ai-rounds'),
      roundLabel: document.getElementById('hud-round-label'),
      serveIndicator: document.getElementById('hud-serve-indicator'),
      situationAlert: document.getElementById('hud-situation-alert'),
      energyCard: document.getElementById('hud-energy-card'),
      energyFill: document.getElementById('hud-energy-fill'),
      energyValue: document.getElementById('hud-energy-value'),
      shotGrade: document.getElementById('hud-shot-grade'),
      pointBanner: document.getElementById('hud-point-banner'),
      prompt: document.getElementById('hud-prompt')
    };
  }

  setPlayerProfile(profile) {
    if (!this.elements.playerBadge || !profile) return;
    this.elements.playerBadge.textContent = profile.badgeText || 'ANGEL (YOU)';
    this.elements.playerBadge.setAttribute('data-character-id', profile.id);
  }

  setDifficultyLabel(difficultyKey = 'normal') {
    if (!this.elements.aiBadge) return;
    const upper = String(difficultyKey).toUpperCase();
    this.elements.aiBadge.textContent = `DUCK (${upper})`;
  }

  triggerElementBump(el) {
    if (!el) return;
    el.classList.remove('score-bump');
    void el.offsetWidth;
    el.classList.add('score-bump');
  }

  updateScore(scoreState, animatedWinner = null, roundEnded = false) {
    const el = this.elements;
    if (el.playerPoints) {
      el.playerPoints.textContent = String(scoreState.playerPoints);
      if (animatedWinner === 'player') {
        this.triggerElementBump(el.playerPoints);
      }
    }
    if (el.aiPoints) {
      el.aiPoints.textContent = String(scoreState.aiPoints);
      if (animatedWinner === 'ai') {
        this.triggerElementBump(el.aiPoints);
      }
    }
    if (el.playerRounds) {
      el.playerRounds.textContent = `R: ${scoreState.playerRounds}`;
      if (roundEnded && animatedWinner === 'player') {
        this.triggerElementBump(el.playerRounds);
      }
    }
    if (el.aiRounds) {
      el.aiRounds.textContent = `R: ${scoreState.aiRounds}`;
      if (roundEnded && animatedWinner === 'ai') {
        this.triggerElementBump(el.aiRounds);
      }
    }
    if (el.roundLabel) {
      el.roundLabel.innerHTML = `ROUND ${scoreState.currentRound} &bull; FIRST TO 7`;
    }
    if (el.serveIndicator) {
      const sideText = scoreState.serveSide === 'deuce' ? 'DEUCE' : 'AD';
      el.serveIndicator.textContent =
        scoreState.server === 'player'
          ? `YOUR SERVE (${sideText})`
          : `DUCK SERVE (${sideText})`;
    }
  }

  updateEnergy(playerEnergy, isPowerAvailable) {
    const pct = Math.round(playerEnergy);
    if (this.elements.energyFill) {
      this.elements.energyFill.style.width = `${pct}%`;
      this.elements.energyFill.classList.toggle('energy-fill-low', !isPowerAvailable);
    }
    if (this.elements.energyValue) {
      this.elements.energyValue.textContent = `${pct}%`;
    }
  }

  flashInsufficientEnergy() {
    if (!this.elements.energyCard) return;
    this.elements.energyCard.classList.remove('energy-insufficient-flash');
    void this.elements.energyCard.offsetWidth;
    this.elements.energyCard.classList.add('energy-insufficient-flash');
  }

  clearInsufficientEnergyFlash() {
    if (!this.elements.energyCard) return;
    this.elements.energyCard.classList.remove('energy-insufficient-flash');
  }

  updateSituationAlert(scoreState, playerShortName = 'ANGEL') {
    const el = this.elements.situationAlert;
    if (!el) return;
    if (scoreState.isMatchPoint) {
      const holderLabel =
        scoreState.pointSituationHolder === 'player' ? playerShortName : 'DUCK AI';
      el.textContent = `MATCH POINT! (${holderLabel})`;
      el.classList.remove('hidden', 'alert-game-point');
      el.classList.add('alert-match-point');
    } else if (scoreState.isGamePoint) {
      const holderLabel =
        scoreState.pointSituationHolder === 'player' ? playerShortName : 'DUCK AI';
      el.textContent = `GAME POINT! (${holderLabel})`;
      el.classList.remove('hidden', 'alert-match-point');
      el.classList.add('alert-game-point');
    } else {
      el.classList.add('hidden');
    }
  }

  showShotGrade(grade = 'GOOD', shotType = 'NORMAL') {
    const el = this.elements.shotGrade;
    if (!el) return;
    el.classList.remove(
      'hidden',
      'grade-perfect',
      'grade-good',
      'grade-miss',
      'grade-special',
      'grade-power'
    );

    if (grade === 'PERFECT') {
      el.textContent = shotType === 'SMASH' ? 'PERFECT SMASH!' : 'PERFECT!';
      el.classList.add(shotType === 'POWER' ? 'grade-power' : 'grade-perfect');
    } else if (grade === 'POWER') {
      el.textContent = 'POWER!';
      el.classList.add('grade-power');
    } else if (grade === 'GOOD') {
      el.textContent =
        shotType === 'NORMAL' || shotType === 'SERVE'
          ? 'GOOD!'
          : `GOOD ${shotType}!`;
      el.classList.add(shotType === 'POWER' ? 'grade-power' : 'grade-good');
    } else if (grade === 'ACE') {
      el.textContent = 'ACE!';
      el.classList.add('grade-special');
    } else if (grade === 'POINT') {
      el.textContent = 'POINT!';
      el.classList.add('grade-special');
    } else if (grade === 'GAME') {
      el.textContent = 'GAME!';
      el.classList.add('grade-special');
    } else if (grade === 'MATCH_POINT') {
      el.textContent = 'MATCH POINT!';
      el.classList.add('grade-special');
    } else if (grade === 'VICTORY') {
      el.textContent = 'VICTORY!';
      el.classList.add('grade-perfect');
    } else if (grade === 'DEFEAT') {
      el.textContent = 'DEFEAT!';
      el.classList.add('grade-miss');
    } else if (grade === 'LOW_ENERGY') {
      el.textContent = 'LOW ENERGY!';
      el.classList.add('grade-miss');
    } else {
      el.textContent = 'MISS!';
      el.classList.add('grade-miss');
    }

    el.classList.remove('banner-pop');
    void el.offsetWidth;
    el.classList.add('banner-pop');
  }

  hideShotGrade() {
    if (this.elements.shotGrade) {
      this.elements.shotGrade.classList.add('hidden');
    }
  }

  showPointBanner(htmlText) {
    const el = this.elements.pointBanner;
    if (!el) return;
    el.innerHTML = htmlText;
    el.classList.remove('hidden', 'banner-pop');
    void el.offsetWidth;
    el.classList.add('banner-pop');
  }

  hidePointBanner() {
    if (this.elements.pointBanner) {
      this.elements.pointBanner.classList.add('hidden');
    }
  }

  setPrompt(htmlText) {
    if (this.elements.prompt) {
      this.elements.prompt.innerHTML = htmlText;
    }
  }
}
