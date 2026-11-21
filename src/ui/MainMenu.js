import { CHARACTER_ROSTER } from '../core/AssetManager.js';

/**
 * MainMenu
 * Manages the Main Menu overlay (Title, Player Level/XP/Coins Progression Bar,
 * Character Selection with Unlock states, Difficulty Selection, Play Match trigger)
 * and the Settings Screen modal (Graphics Quality, Movement Assist, Camera Shake,
 * Mute All Audio, and SFX/Music Volume sliders).
 */
export class MainMenu {
  constructor(callbacks = {}) {
    this.onPlayMatch = callbacks.onPlayMatch || (() => {});
    this.onCharacterSelect = callbacks.onCharacterSelect || (() => {});
    this.onDifficultySelect = callbacks.onDifficultySelect || (() => {});
    this.onQualityChange = callbacks.onQualityChange || (() => {});
    this.onAssistChange = callbacks.onAssistChange || (() => {});
    this.onShakeChange = callbacks.onShakeChange || (() => {});
    this.onMuteChange = callbacks.onMuteChange || (() => {});
    this.onVolumeChange = callbacks.onVolumeChange || (() => {});
    this.onUiSound = callbacks.onUiSound || (() => {});

    this.menuEl = document.getElementById('main-menu-overlay');
    this.playBtn = document.getElementById('btn-menu-play');
    this.openSettingsBtn = document.getElementById('btn-menu-settings');

    // Progression Bar elements
    this.levelEl = document.getElementById('menu-player-level');
    this.xpFillEl = document.getElementById('menu-xp-fill');
    this.xpTextEl = document.getElementById('menu-xp-text');
    this.coinsEl = document.getElementById('menu-player-coins');

    this.charCards = document.querySelectorAll('[data-select-character]');
    this.diffBtns = document.querySelectorAll('[data-menu-difficulty]');
    this.previewNameEl = document.getElementById('char-preview-name');
    this.previewDescEl = document.getElementById('char-preview-desc');
    this.previewSpdEl = document.getElementById('char-preview-spd');
    this.previewPwrEl = document.getElementById('char-preview-pwr');
    this.previewCtlEl = document.getElementById('char-preview-ctl');

    // Settings Modal elements
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsBtn = document.getElementById('btn-settings-close');
    this.qualityBtns = document.querySelectorAll('[data-settings-quality]');
    this.assistToggleBtn = document.getElementById('btn-toggle-assist');
    this.shakeToggleBtn = document.getElementById('btn-toggle-shake');
    this.muteToggleBtn = document.getElementById('btn-toggle-mute');
    this.sfxSlider = document.getElementById('input-sfx-volume');
    this.sfxLabel = document.getElementById('label-sfx-volume');
    this.bgmSlider = document.getElementById('input-bgm-volume');
    this.bgmLabel = document.getElementById('label-bgm-volume');

    this.selectedCharacter = 'angel';
    this.selectedDifficulty = 'normal';
    this.settings = {
      quality: 'high',
      movementAssist: false,
      cameraShake: true,
      muted: false,
      sfxVolume: 80,
      bgmVolume: 65
    };

    this.isOpen = false;
    this.isSettingsOpen = false;

    this.bindEvents();
  }

  bindEvents() {
    if (this.playBtn) {
      this.playBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        this.hide();
        this.onPlayMatch({
          characterId: this.selectedCharacter,
          difficulty: this.selectedDifficulty
        });
      });
    }

    if (this.openSettingsBtn) {
      this.openSettingsBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        this.showSettings();
      });
    }

    this.charCards.forEach((card) => {
      card.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        const charId = card.getAttribute('data-select-character');
        this.selectCharacter(charId);
      });
    });

    this.diffBtns.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        const level = btn.getAttribute('data-menu-difficulty');
        this.selectDifficulty(level);
      });
    });

    if (this.closeSettingsBtn) {
      this.closeSettingsBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        this.hideSettings();
      });
    }

    this.qualityBtns.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        const mode = btn.getAttribute('data-settings-quality');
        this.setQuality(mode);
      });
    });

    if (this.assistToggleBtn) {
      this.assistToggleBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        this.setMovementAssist(!this.settings.movementAssist);
      });
    }

    if (this.shakeToggleBtn) {
      this.shakeToggleBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onUiSound();
        this.setCameraShake(!this.settings.cameraShake);
      });
    }

    if (this.muteToggleBtn) {
      this.muteToggleBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setMuted(!this.settings.muted);
        this.onUiSound();
      });
    }

    if (this.sfxSlider) {
      this.sfxSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.settings.sfxVolume = val;
        if (this.sfxLabel) this.sfxLabel.textContent = `${val}%`;
        this.onVolumeChange({
          sfxVolume: this.settings.sfxVolume,
          bgmVolume: this.settings.bgmVolume
        });
      });
    }

    if (this.bgmSlider) {
      this.bgmSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.settings.bgmVolume = val;
        if (this.bgmLabel) this.bgmLabel.textContent = `${val}%`;
        this.onVolumeChange({
          sfxVolume: this.settings.sfxVolume,
          bgmVolume: this.settings.bgmVolume
        });
      });
    }
  }

  updateProgression({ level = 1, xpIntoLevel = 0, xpRequired = 100, progressPct = 0, coins = 0 } = {}) {
    if (this.levelEl) {
      this.levelEl.textContent = `LVL ${level}`;
    }
    if (this.xpFillEl) {
      this.xpFillEl.style.width = `${progressPct}%`;
    }
    if (this.xpTextEl) {
      this.xpTextEl.textContent = `${xpIntoLevel} / ${xpRequired} XP`;
    }
    if (this.coinsEl) {
      this.coinsEl.textContent = `★ ${coins}`;
    }
    this.refreshCharacterCards();
  }

  refreshCharacterCards() {
    this.charCards.forEach((card) => {
      const charId = card.getAttribute('data-select-character');
      const profile = CHARACTER_ROSTER[charId];
      if (!profile) return;

      const isUnlocked = Boolean(profile.unlocked);
      const isSelected = isUnlocked && charId === this.selectedCharacter;
      card.classList.toggle('char-card-locked', !isUnlocked);
      card.classList.toggle('char-card-active', isSelected);
      card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      const pill = card.querySelector('.char-selected-pill');
      if (pill) {
        if (!isUnlocked) {
          pill.textContent = `LVL ${profile.unlockLevel}`;
        } else {
          pill.textContent = isSelected ? 'SELECTED' : 'READY';
        }
      }
    });
  }

  updatePreviewBanner(profile, lockedAttempt = false) {
    if (!profile) return;
    if (this.previewNameEl) {
      this.previewNameEl.textContent = lockedAttempt
        ? `${profile.name} • LOCKED (${profile.unlockCondition.toUpperCase()})`
        : `${profile.name} • ${profile.role.toUpperCase()}`;
    }
    if (this.previewDescEl) {
      this.previewDescEl.textContent = profile.previewDesc;
    }
    if (profile.stats) {
      if (this.previewSpdEl) this.previewSpdEl.textContent = `SPD ${profile.stats.speed}`;
      if (this.previewPwrEl) this.previewPwrEl.textContent = `PWR ${profile.stats.power}`;
      if (this.previewCtlEl) this.previewCtlEl.textContent = `CTL ${profile.stats.control}`;
    }
  }

  selectCharacter(charId = 'angel', notify = true) {
    const profile = CHARACTER_ROSTER[charId] || CHARACTER_ROSTER.angel;
    if (!profile.unlocked) {
      this.updatePreviewBanner(profile, true);
      return false;
    }

    this.selectedCharacter = profile.id;
    this.refreshCharacterCards();
    this.updatePreviewBanner(profile, false);

    if (notify) {
      this.onCharacterSelect(profile.id);
    }
    return true;
  }

  selectDifficulty(level = 'normal', notify = true) {
    this.selectedDifficulty = level;
    this.diffBtns.forEach((btn) => {
      const match = btn.getAttribute('data-menu-difficulty') === level;
      btn.classList.toggle('diff-btn-active', match);
    });
    if (notify) {
      this.onDifficultySelect(level);
    }
  }

  setQuality(mode = 'high', notify = true) {
    this.settings.quality = mode === 'low' ? 'low' : 'high';
    this.qualityBtns.forEach((btn) => {
      const match = btn.getAttribute('data-settings-quality') === this.settings.quality;
      btn.classList.toggle('diff-btn-active', match);
    });
    if (notify) {
      this.onQualityChange(this.settings.quality);
    }
  }

  setMovementAssist(enabled = false, notify = true) {
    this.settings.movementAssist = Boolean(enabled);
    if (this.assistToggleBtn) {
      this.assistToggleBtn.textContent = this.settings.movementAssist ? 'ON' : 'OFF';
      this.assistToggleBtn.classList.toggle(
        'toggle-btn-on',
        this.settings.movementAssist
      );
    }
    if (notify) {
      this.onAssistChange(this.settings.movementAssist);
    }
  }

  setCameraShake(enabled = true, notify = true) {
    this.settings.cameraShake = Boolean(enabled);
    if (this.shakeToggleBtn) {
      this.shakeToggleBtn.textContent = this.settings.cameraShake ? 'ON' : 'OFF';
      this.shakeToggleBtn.classList.toggle(
        'toggle-btn-on',
        this.settings.cameraShake
      );
    }
    if (notify) {
      this.onShakeChange(this.settings.cameraShake);
    }
  }

  setMuted(muted = false, notify = true) {
    this.settings.muted = Boolean(muted);
    if (this.muteToggleBtn) {
      this.muteToggleBtn.textContent = this.settings.muted ? 'ON' : 'OFF';
      this.muteToggleBtn.classList.toggle('toggle-btn-on', this.settings.muted);
    }
    if (notify) {
      this.onMuteChange(this.settings.muted);
    }
  }

  setVolumes({ sfxVolume = 80, bgmVolume = 65 } = {}, notify = true) {
    this.settings.sfxVolume = sfxVolume;
    this.settings.bgmVolume = bgmVolume;
    if (this.sfxSlider) this.sfxSlider.value = String(sfxVolume);
    if (this.sfxLabel) this.sfxLabel.textContent = `${sfxVolume}%`;
    if (this.bgmSlider) this.bgmSlider.value = String(bgmVolume);
    if (this.bgmLabel) this.bgmLabel.textContent = `${bgmVolume}%`;
    if (notify) {
      this.onVolumeChange({
        sfxVolume: this.settings.sfxVolume,
        bgmVolume: this.settings.bgmVolume
      });
    }
  }

  show() {
    this.isOpen = true;
    this.refreshCharacterCards();
    if (this.menuEl) {
      this.menuEl.classList.remove('hidden');
      this.menuEl.setAttribute('aria-hidden', 'false');
    }
  }

  hide() {
    this.isOpen = false;
    if (this.menuEl) {
      this.menuEl.classList.add('hidden');
      this.menuEl.setAttribute('aria-hidden', 'true');
    }
  }

  showSettings() {
    this.isSettingsOpen = true;
    if (this.settingsModal) {
      this.settingsModal.classList.remove('hidden');
      this.settingsModal.setAttribute('aria-hidden', 'false');
    }
  }

  hideSettings() {
    this.isSettingsOpen = false;
    if (this.settingsModal) {
      this.settingsModal.classList.add('hidden');
      this.settingsModal.setAttribute('aria-hidden', 'true');
    }
  }
}
