/**
 * ResultsScreen
 * Manages the end-of-match Results modal displaying Winner (VICTORY! / DEFEAT!),
 * final round score, round-by-round point breakdown, match statistics,
 * Phase 5 XP/Coins/Level/Character Unlock rewards, Rematch, and Main Menu navigation.
 */
export class ResultsScreen {
  constructor(callbacks = {}) {
    this.onRematch = callbacks.onRematch || (() => {});
    this.onMainMenu = callbacks.onMainMenu || (() => {});
    this.onUiSound = callbacks.onUiSound || (() => {});

    this.modal = document.getElementById('results-modal');
    this.titleEl = document.getElementById('results-title');
    this.subtitleEl = document.getElementById('results-subtitle');
    this.finalScoreEl = document.getElementById('results-final-score');
    this.roundsListEl = document.getElementById('results-rounds-list');
    this.statPerfectsEl = document.getElementById('res-stat-perfects');
    this.statAcesEl = document.getElementById('res-stat-aces');
    this.statPointsEl = document.getElementById('res-stat-points');

    // Phase 5 Rewards elements
    this.xpEarnedEl = document.getElementById('res-xp-earned');
    this.coinsEarnedEl = document.getElementById('res-coins-earned');
    this.levelBadgeEl = document.getElementById('res-level-badge');
    this.unlockBannerEl = document.getElementById('res-unlock-banner');

    this.rematchBtn = document.getElementById('btn-results-rematch');
    this.menuBtn = document.getElementById('btn-results-menu');

    this.isOpen = false;
    this.bindEvents();
  }

  bindEvents() {
    if (this.rematchBtn) {
      this.rematchBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        this.hide();
        this.onRematch();
      });
    }

    if (this.menuBtn) {
      this.menuBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        this.hide();
        this.onMainMenu();
      });
    }
  }

  /**
   * Populates and displays the Results Screen at match completion.
   */
  show({
    winner = 'player',
    playerName = 'ANGEL',
    playerRounds = 2,
    aiRounds = 0,
    roundHistory = [],
    stats = {},
    rewards = null
  }) {
    this.isOpen = true;
    const isVictory = winner === 'player';

    if (this.titleEl) {
      this.titleEl.textContent = isVictory ? 'VICTORY!' : 'DEFEAT!';
      this.titleEl.classList.toggle('results-victory', isVictory);
      this.titleEl.classList.toggle('results-defeat', !isVictory);
    }

    if (this.subtitleEl) {
      this.subtitleEl.textContent = isVictory
        ? `${playerName} WINS THE MATCH!`
        : 'DUCK AI WINS THE MATCH!';
    }

    if (this.finalScoreEl) {
      this.finalScoreEl.textContent = `${playerRounds} - ${aiRounds}`;
    }

    if (this.roundsListEl) {
      this.roundsListEl.innerHTML = '';
      roundHistory.forEach((r) => {
        const pill = document.createElement('div');
        pill.className = 'results-round-pill';
        pill.textContent = `R${r.round}: ${r.playerPoints} - ${r.aiPoints}`;
        this.roundsListEl.appendChild(pill);
      });
    }

    if (this.statPerfectsEl) {
      this.statPerfectsEl.textContent = String(stats.perfectShots ?? 0);
    }
    if (this.statAcesEl) {
      this.statAcesEl.textContent = String(stats.aces ?? 0);
    }
    if (this.statPointsEl) {
      this.statPointsEl.textContent = String(stats.totalPlayerPoints ?? 0);
    }

    if (rewards) {
      if (this.xpEarnedEl) {
        this.xpEarnedEl.textContent = `+${rewards.xpEarned} XP`;
      }
      if (this.coinsEarnedEl) {
        this.coinsEarnedEl.textContent = `+${rewards.coinsEarned} COINS`;
      }
      if (this.levelBadgeEl) {
        this.levelBadgeEl.textContent = rewards.leveledUp
          ? `LEVEL UP! LVL ${rewards.newLevel}`
          : `LVL ${rewards.newLevel}`;
      }
      if (this.unlockBannerEl) {
        const unlocked = rewards.newlyUnlockedCharacters || [];
        if (unlocked.length > 0) {
          this.unlockBannerEl.textContent = `NEW CHARACTER UNLOCKED: ${unlocked.join(', ')}!`;
          this.unlockBannerEl.classList.remove('hidden');
        } else {
          this.unlockBannerEl.classList.add('hidden');
        }
      }
    }

    if (this.modal) {
      this.modal.classList.remove('hidden');
      this.modal.setAttribute('aria-hidden', 'false');
    }
  }

  hide() {
    this.isOpen = false;
    if (this.modal) {
      this.modal.classList.add('hidden');
      this.modal.setAttribute('aria-hidden', 'true');
    }
  }
}
