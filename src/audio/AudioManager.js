import { Howl, Howler } from 'howler';

/**
 * AudioManager
 * Manages background music and arcade sound effects using Howler.js.
 * Supports separate SFX and Music volume controls, mute state,
 * browser user-gesture audio unlock, and deterministic play event tracking.
 */
export class AudioManager {
  constructor(initialSettings = {}) {
    this.sfxVolume =
      Number.isFinite(initialSettings.sfxVolume) ? initialSettings.sfxVolume : 80;
    this.bgmVolume =
      Number.isFinite(initialSettings.bgmVolume) ? initialSettings.bgmVolume : 65;
    this.muted = Boolean(initialSettings.muted);

    this.sounds = {};
    this.bgmPlaying = false;
    this.audioUnlocked = false;
    this.lastPlayedSound = null;
    this.playHistory = [];
    this.playCounts = {};

    this.initHowls();
    this.applyVolumeSettings();
    this.bindUserGestureUnlock();
  }

  initHowls() {
    const soundManifest = {
      bgm: { src: ['/audio/bgm_arcade.wav'], loop: true, isBgm: true, baseVol: 0.38 },
      uiTap: { src: ['/audio/ui_tap.wav'], loop: false, isBgm: false, baseVol: 0.55 },
      serveToss: { src: ['/audio/serve_toss.wav'], loop: false, isBgm: false, baseVol: 0.5 },
      racketHit: { src: ['/audio/racket_hit.wav'], loop: false, isBgm: false, baseVol: 0.72 },
      racketPower: { src: ['/audio/racket_power.wav'], loop: false, isBgm: false, baseVol: 0.85 },
      racketSmash: { src: ['/audio/racket_smash.wav'], loop: false, isBgm: false, baseVol: 0.92 },
      ballBounce: { src: ['/audio/ball_bounce.wav'], loop: false, isBgm: false, baseVol: 0.6 },
      netHit: { src: ['/audio/net_hit.wav'], loop: false, isBgm: false, baseVol: 0.65 },
      perfect: { src: ['/audio/perfect_chime.wav'], loop: false, isBgm: false, baseVol: 0.8 },
      ace: { src: ['/audio/ace_fanfare.wav'], loop: false, isBgm: false, baseVol: 0.85 },
      point: { src: ['/audio/point_chime.wav'], loop: false, isBgm: false, baseVol: 0.75 },
      victory: { src: ['/audio/victory_fanfare.wav'], loop: false, isBgm: false, baseVol: 0.9 },
      defeat: { src: ['/audio/defeat_jingle.wav'], loop: false, isBgm: false, baseVol: 0.82 }
    };

    for (const [key, cfg] of Object.entries(soundManifest)) {
      this.playCounts[key] = 0;
      this.sounds[key] = {
        ...cfg,
        howl: new Howl({
          src: cfg.src,
          loop: cfg.loop,
          preload: true,
          volume: cfg.baseVol
        })
      };
    }
  }

  bindUserGestureUnlock() {
    const unlock = () => {
      if (this.audioUnlocked) return;
      this.audioUnlocked = true;
      this.startBgm();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  applyVolumeSettings() {
    Howler.mute(this.muted);
    const sfxNorm = Math.max(0, Math.min(1, this.sfxVolume / 100));
    const bgmNorm = Math.max(0, Math.min(1, this.bgmVolume / 100));

    for (const entry of Object.values(this.sounds)) {
      const targetVol = entry.isBgm
        ? entry.baseVol * bgmNorm
        : entry.baseVol * sfxNorm;
      entry.howl.volume(targetVol);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    this.applyVolumeSettings();
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    this.applyVolumeSettings();
  }

  setVolumes({ sfxVolume, bgmVolume } = {}) {
    if (Number.isFinite(sfxVolume)) {
      this.sfxVolume = Math.max(0, Math.min(100, Math.round(sfxVolume)));
    }
    if (Number.isFinite(bgmVolume)) {
      this.bgmVolume = Math.max(0, Math.min(100, Math.round(bgmVolume)));
    }
    this.applyVolumeSettings();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.applyVolumeSettings();
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  startBgm() {
    const bgmEntry = this.sounds.bgm;
    if (!bgmEntry) return;
    this.recordPlay('bgm');
    if (!this.bgmPlaying) {
      this.bgmPlaying = true;
      try {
        bgmEntry.howl.play();
      } catch (_err) {
        // Ignore browser autoplay block if triggered before user gesture
      }
    }
  }

  stopBgm() {
    const bgmEntry = this.sounds.bgm;
    if (!bgmEntry) return;
    this.bgmPlaying = false;
    try {
      bgmEntry.howl.stop();
    } catch (_err) {}
  }

  recordPlay(key) {
    this.lastPlayedSound = key;
    this.playCounts[key] = (this.playCounts[key] || 0) + 1;
    this.playHistory.push(key);
    if (this.playHistory.length > 32) {
      this.playHistory.shift();
    }
  }

  play(key) {
    const entry = this.sounds[key];
    if (!entry) return false;

    this.recordPlay(key);
    if (this.muted || (!entry.isBgm && this.sfxVolume <= 0)) {
      return false;
    }

    try {
      entry.howl.play();
      return true;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Plays contextual racket contact audio based on shot type and timing grade.
   */
  playRacketImpact(shotType = 'NORMAL', grade = 'GOOD') {
    if (shotType === 'SMASH') {
      this.play('racketSmash');
    } else if (shotType === 'POWER') {
      this.play('racketPower');
    } else {
      this.play('racketHit');
    }

    if (grade === 'PERFECT') {
      this.play('perfect');
    }
  }
}
