import { AssetManager } from './AssetManager.js';
import { SceneManager } from './SceneManager.js';
import { CameraManager } from './CameraManager.js';
import { InputManager } from '../controls/InputManager.js';
import { MatchManager } from '../gameplay/MatchManager.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { MainMenu } from '../ui/MainMenu.js';
import { ResultsScreen } from '../ui/ResultsScreen.js';
import { SaveManager } from '../data/SaveManager.js';
import { AudioManager } from '../audio/AudioManager.js';

/**
 * GameManager
 * Top-level lifecycle manager owning the Three.js scene, camera, fixed-timestep
 * physics accumulator, resize listeners, SaveManager (progression & LocalStorage),
 * AudioManager (Howler.js), MainMenu, PauseMenu, ResultsScreen, and MatchManager.
 */
export class GameManager {
  constructor(container) {
    this.container = container;
    this.assetManager = new AssetManager();
    this.saveManager = new SaveManager();
    this.audioManager = null;
    this.sceneManager = null;
    this.cameraManager = null;
    this.inputManager = null;
    this.matchManager = null;
    this.mainMenu = null;
    this.pauseMenu = null;
    this.resultsScreen = null;

    this.fixedDt = 1 / 120; // 120Hz fixed physics step
    this.accumulator = 0;
    this.lastTime = 0;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.qualityMode = 'high'; // 'high' | 'low'
    this.audioSettings = {
      sfxVolume: 80,
      bgmVolume: 65,
      muted: false
    };
    this.lastStepMs = 0;
  }

  async init() {
    const loadingBar = document.getElementById('loading-bar-fill');
    const loadingScreen = document.getElementById('loading-screen');

    const updateProgress = (ratio) => {
      if (loadingBar) {
        loadingBar.style.width = `${Math.round(ratio * 100)}%`;
      }
    };

    updateProgress(0.15);
    await this.assetManager.init((p) => updateProgress(0.15 + p * 0.45));

    const saved = this.saveManager.data;
    this.audioSettings = { ...saved.settings };
    this.audioManager = new AudioManager(saved.settings);

    this.sceneManager = new SceneManager(this.container, this.assetManager);
    this.cameraManager = new CameraManager();
    this.inputManager = new InputManager(this.sceneManager.renderer.domElement, {
      onPauseToggle: () => {
        if (this.audioManager) this.audioManager.play('uiTap');
        this.togglePause();
      }
    });

    updateProgress(0.85);
    this.matchManager = new MatchManager(
      this.sceneManager,
      this.cameraManager,
      this.assetManager,
      this.inputManager,
      {
        audioManager: this.audioManager,
        onMatchComplete: (summary) => {
          const rewards = this.saveManager.recordMatchResult({
            won: summary.winner === 'player',
            difficulty: summary.difficulty,
            playerPoints: summary.stats?.totalPlayerPoints || 0,
            perfectShots: summary.stats?.perfectShots || 0,
            aces: summary.stats?.aces || 0
          });
          this.syncMenuProgression();
          if (this.resultsScreen) {
            this.resultsScreen.show({
              ...summary,
              rewards
            });
          }
        }
      }
    );

    this.mainMenu = new MainMenu({
      onUiSound: () => {
        if (this.audioManager) this.audioManager.play('uiTap');
      },
      onPlayMatch: ({ characterId, difficulty }) => {
        this.saveManager.setSelectedCharacter(characterId);
        this.saveManager.setSelectedDifficulty(difficulty);
        this.matchManager.selectCharacter(characterId);
        this.matchManager.selectDifficulty(difficulty);
        if (this.pauseMenu) {
          this.pauseMenu.setActiveDifficultyButton(difficulty);
        }
        if (this.resultsScreen) {
          this.resultsScreen.hide();
        }
        this.setPaused(false);
        this.matchManager.restartMatch();
      },
      onCharacterSelect: (charId) => {
        this.saveManager.setSelectedCharacter(charId);
        this.matchManager.selectCharacter(charId);
        this.sceneManager.render(this.cameraManager.camera);
      },
      onDifficultySelect: (level) => {
        this.saveManager.setSelectedDifficulty(level);
        this.matchManager.selectDifficulty(level);
        if (this.pauseMenu) {
          this.pauseMenu.setActiveDifficultyButton(level);
        }
      },
      onQualityChange: (mode) => {
        this.setQualityMode(mode);
        this.saveManager.updateSettings({ quality: this.qualityMode });
        if (this.pauseMenu) {
          this.pauseMenu.setActiveQualityButton(this.qualityMode);
        }
        this.sceneManager.render(this.cameraManager.camera);
      },
      onAssistChange: (enabled) => {
        this.matchManager.player.setMovementAssist(enabled);
        this.saveManager.updateSettings({ movementAssist: Boolean(enabled) });
      },
      onShakeChange: (enabled) => {
        this.cameraManager.setShakeEnabled(enabled);
        this.saveManager.updateSettings({ cameraShake: Boolean(enabled) });
      },
      onMuteChange: (muted) => {
        this.audioSettings.muted = Boolean(muted);
        if (this.audioManager) {
          this.audioManager.setMuted(muted);
        }
        this.saveManager.updateSettings({ muted: Boolean(muted) });
      },
      onVolumeChange: (vols) => {
        this.audioSettings = { ...this.audioSettings, ...vols };
        if (this.audioManager) {
          this.audioManager.setVolumes(vols);
        }
        this.saveManager.updateSettings(vols);
      }
    });

    this.pauseMenu = new PauseMenu({
      onResume: () => {
        if (this.audioManager) this.audioManager.play('uiTap');
        this.setPaused(false);
      },
      onRestart: () => {
        if (this.audioManager) this.audioManager.play('uiTap');
        if (this.resultsScreen) this.resultsScreen.hide();
        this.matchManager.restartMatch();
        this.setPaused(false);
      },
      onOpenSettings: () => {
        if (this.audioManager) this.audioManager.play('uiTap');
        if (this.mainMenu) {
          this.mainMenu.showSettings();
        }
      },
      onMainMenu: () => {
        if (this.audioManager) this.audioManager.play('uiTap');
        this.openMainMenu();
      },
      onDifficultyChange: (level) => {
        if (this.audioManager) this.audioManager.play('uiTap');
        this.saveManager.setSelectedDifficulty(level);
        this.matchManager.selectDifficulty(level);
        if (this.mainMenu) {
          this.mainMenu.selectDifficulty(level, false);
        }
      },
      onQualityChange: (mode) => {
        if (this.audioManager) this.audioManager.play('uiTap');
        this.setQualityMode(mode);
        this.saveManager.updateSettings({ quality: this.qualityMode });
        if (this.mainMenu) {
          this.mainMenu.setQuality(this.qualityMode, false);
        }
      }
    });

    this.resultsScreen = new ResultsScreen({
      onUiSound: () => {
        if (this.audioManager) this.audioManager.play('uiTap');
      },
      onRematch: () => {
        this.setPaused(false);
        this.matchManager.restartMatch();
      },
      onMainMenu: () => {
        this.openMainMenu();
      }
    });

    // Apply persisted save state across all systems
    this.applySavedState();

    // Bind top-left Menu quick-button
    const hudMenuBtn = document.getElementById('btn-hud-menu');
    if (hudMenuBtn) {
      hudMenuBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.audioManager) this.audioManager.play('uiTap');
        this.openMainMenu();
      });
    }

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 80);
    });

    updateProgress(1.0);
    this.sceneManager.render(this.cameraManager.camera);

    if (loadingScreen) {
      loadingScreen.classList.add('loaded');
    }

    this.start();
  }

  applySavedState() {
    const data = this.saveManager.data;
    const settings = data.settings;

    this.syncMenuProgression();

    this.matchManager.selectCharacter(data.selectedCharacter);
    this.matchManager.selectDifficulty(data.selectedDifficulty);
    this.matchManager.player.setMovementAssist(settings.movementAssist);
    this.cameraManager.setShakeEnabled(settings.cameraShake);
    this.setQualityMode(settings.quality);

    if (this.audioManager) {
      this.audioManager.setVolumes({
        sfxVolume: settings.sfxVolume,
        bgmVolume: settings.bgmVolume
      });
      this.audioManager.setMuted(settings.muted);
    }

    if (this.mainMenu) {
      this.mainMenu.selectCharacter(data.selectedCharacter, false);
      this.mainMenu.selectDifficulty(data.selectedDifficulty, false);
      this.mainMenu.setQuality(settings.quality, false);
      this.mainMenu.setMovementAssist(settings.movementAssist, false);
      this.mainMenu.setCameraShake(settings.cameraShake, false);
      this.mainMenu.setMuted(settings.muted, false);
      this.mainMenu.setVolumes(
        { sfxVolume: settings.sfxVolume, bgmVolume: settings.bgmVolume },
        false
      );
    }

    if (this.pauseMenu) {
      this.pauseMenu.setActiveDifficultyButton(data.selectedDifficulty);
      this.pauseMenu.setActiveQualityButton(settings.quality);
    }
  }

  syncMenuProgression() {
    if (!this.mainMenu || !this.saveManager) return;
    const prog = this.saveManager.getXpProgress();
    this.mainMenu.updateProgression({
      ...prog,
      coins: this.saveManager.data.coins
    });
  }

  getPerformanceMetrics() {
    const renderStats = this.sceneManager
      ? this.sceneManager.getRenderStats()
      : { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
    return {
      ...renderStats,
      qualityMode: this.qualityMode,
      lastStepMs: Number(this.lastStepMs.toFixed(3)),
      particlePoolSize: this.matchManager?.effects?.particles?.pool?.length || 0,
      trailPoolSize: this.matchManager?.ball?.ballTrail?.pointPool?.length || 0
    };
  }

  openMainMenu() {
    this.setPaused(false);
    this.syncMenuProgression();
    if (this.resultsScreen) {
      this.resultsScreen.hide();
    }
    if (this.mainMenu) {
      this.mainMenu.show();
    }
  }

  closeMainMenu() {
    if (this.mainMenu) {
      this.mainMenu.hide();
      this.mainMenu.hideSettings();
    }
  }

  setQualityMode(mode = 'high') {
    this.qualityMode = mode === 'low' ? 'low' : 'high';
    if (this.sceneManager) {
      this.sceneManager.setQualityMode(this.qualityMode);
    }
    if (this.matchManager && this.matchManager.effects) {
      this.matchManager.effects.setQualityMode(this.qualityMode);
    }
  }

  togglePause() {
    this.setPaused(!this.isPaused);
  }

  setPaused(paused) {
    this.isPaused = Boolean(paused);
    if (this.inputManager) {
      this.inputManager.resetAllInput();
    }
    if (this.pauseMenu) {
      if (this.isPaused) {
        this.pauseMenu.show();
      } else {
        this.pauseMenu.hide();
        if (this.mainMenu) {
          this.mainMenu.hideSettings();
        }
      }
    }
    this.lastTime = performance.now();
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (this.cameraManager) {
      this.cameraManager.updateFraming(width, height);
    }
    if (this.sceneManager) {
      this.sceneManager.onResize(width, height);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  isModalOverlayOpen() {
    const mainOpen = Boolean(this.mainMenu && (this.mainMenu.isOpen || this.mainMenu.isSettingsOpen));
    const resultsOpen = Boolean(this.resultsScreen && this.resultsScreen.isOpen);
    return this.isPaused || mainOpen || resultsOpen;
  }

  advanceTime(rawDt) {
    if (this.isPaused) {
      return;
    }

    const t0 = performance.now();
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    this.elapsedTime += dt;
    this.accumulator += dt;

    let substeps = 0;
    while (this.accumulator >= this.fixedDt && substeps < 16) {
      this.matchManager.stepPhysics(this.fixedDt);
      this.accumulator -= this.fixedDt;
      substeps += 1;
    }

    this.matchManager.update(dt, this.elapsedTime);
    this.cameraManager.update(dt);
    this.sceneManager.render(this.cameraManager.camera);
    this.lastStepMs = performance.now() - t0;
  }

  loop(now) {
    if (!this.isRunning) return;

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!this.isModalOverlayOpen()) {
      this.advanceTime(rawDt);
    }

    requestAnimationFrame((nextNow) => this.loop(nextNow));
  }
}
