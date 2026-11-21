/**
 * PauseMenu
 * Manages the pause overlay modal, resume, restart match, settings trigger,
 * return to main menu, AI difficulty quick-toggle, and mobile graphics quality toggle.
 */
export class PauseMenu {
  constructor(callbacks = {}) {
    this.onResume = callbacks.onResume || (() => {});
    this.onRestart = callbacks.onRestart || (() => {});
    this.onOpenSettings = callbacks.onOpenSettings || (() => {});
    this.onMainMenu = callbacks.onMainMenu || (() => {});
    this.onDifficultyChange = callbacks.onDifficultyChange || (() => {});
    this.onQualityChange = callbacks.onQualityChange || (() => {});

    this.modal = document.getElementById('pause-modal');
    this.resumeBtn = document.getElementById('btn-pause-resume');
    this.restartBtn = document.getElementById('btn-pause-restart');
    this.settingsBtn = document.getElementById('btn-pause-settings');
    this.mainMenuBtn = document.getElementById('btn-pause-menu');
    this.difficultyButtons = document.querySelectorAll('[data-ai-difficulty]');
    this.qualityButtons = document.querySelectorAll('[data-graphics-quality]');

    this.isOpen = false;
    this.bindEvents();
  }

  bindEvents() {
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onResume();
      });
    }

    if (this.restartBtn) {
      this.restartBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onRestart();
      });
    }

    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onOpenSettings();
      });
    }

    if (this.mainMenuBtn) {
      this.mainMenuBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onMainMenu();
      });
    }

    this.difficultyButtons.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const level = btn.getAttribute('data-ai-difficulty');
        this.setActiveDifficultyButton(level);
        this.onDifficultyChange(level);
      });
    });

    this.qualityButtons.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = btn.getAttribute('data-graphics-quality');
        this.setActiveQualityButton(mode);
        this.onQualityChange(mode);
      });
    });
  }

  setActiveDifficultyButton(level) {
    this.difficultyButtons.forEach((btn) => {
      const isMatch = btn.getAttribute('data-ai-difficulty') === level;
      btn.classList.toggle('diff-btn-active', isMatch);
    });
  }

  setActiveQualityButton(mode) {
    this.qualityButtons.forEach((btn) => {
      const isMatch = btn.getAttribute('data-graphics-quality') === mode;
      btn.classList.toggle('diff-btn-active', isMatch);
    });
  }

  show() {
    this.isOpen = true;
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
