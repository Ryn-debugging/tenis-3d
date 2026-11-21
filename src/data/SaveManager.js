import { CHARACTER_ROSTER } from '../core/AssetManager.js';

export const SAVE_STORAGE_KEY = 'tennis_angel_save_v1';
export const SAVE_SCHEMA_VERSION = 1;
export const XP_PER_LEVEL = 100;

/**
 * SaveManager
 * Manages persistent player progression (XP, Level, Coins, Character Unlocks,
 * Match Statistics), selected character/difficulty, and user settings in LocalStorage.
 * Safely recovers from missing, malformed, or version-mismatched save data.
 */
export class SaveManager {
  constructor(storageKey = SAVE_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.data = this.getDefaultData();
    this.load();
  }

  getDefaultData() {
    return {
      version: SAVE_SCHEMA_VERSION,
      xp: 0,
      level: 1,
      coins: 0,
      unlockedCharacters: ['angel', 'sky_angel', 'sunny_duck'],
      selectedCharacter: 'angel',
      selectedDifficulty: 'normal',
      settings: {
        quality: 'high',
        movementAssist: true,
        cameraShake: true,
        sfxVolume: 80,
        bgmVolume: 65,
        muted: false
      },
      stats: {
        matchesPlayed: 0,
        matchesWon: 0,
        totalPointsWon: 0,
        totalPerfectShots: 0,
        totalAces: 0
      }
    };
  }

  /**
   * Validates and merges untrusted raw JSON against the canonical schema.
   */
  sanitize(raw) {
    const defaults = this.getDefaultData();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return defaults;
    }

    if (raw.version !== SAVE_SCHEMA_VERSION) {
      return defaults;
    }

    const xp = Number.isFinite(raw.xp) && raw.xp >= 0 ? Math.floor(raw.xp) : 0;
    const computedLevel = Math.floor(xp / XP_PER_LEVEL) + 1;
    const rawLevel = Number.isFinite(raw.level) && raw.level >= 1 ? Math.floor(raw.level) : 1;
    const level = Math.max(computedLevel, rawLevel);
    const coins = Number.isFinite(raw.coins) && raw.coins >= 0 ? Math.floor(raw.coins) : 0;

    // Validate unlockedCharacters list
    const validIds = Object.keys(CHARACTER_ROSTER);
    const unlockedSet = new Set(defaults.unlockedCharacters);
    if (Array.isArray(raw.unlockedCharacters)) {
      for (const id of raw.unlockedCharacters) {
        if (typeof id === 'string' && validIds.includes(id)) {
          unlockedSet.add(id);
        }
      }
    }

    // Automatically unlock characters whose unlockLevel <= current level
    for (const charId of validIds) {
      const profile = CHARACTER_ROSTER[charId];
      if (profile && profile.unlockLevel <= level) {
        unlockedSet.add(charId);
      }
    }

    const unlockedCharacters = Array.from(unlockedSet);

    const selectedCharacter =
      typeof raw.selectedCharacter === 'string' &&
      validIds.includes(raw.selectedCharacter) &&
      unlockedCharacters.includes(raw.selectedCharacter)
        ? raw.selectedCharacter
        : 'angel';

    const validDiffs = ['easy', 'normal', 'hard'];
    const selectedDifficulty =
      typeof raw.selectedDifficulty === 'string' && validDiffs.includes(raw.selectedDifficulty)
        ? raw.selectedDifficulty
        : 'normal';

    const rawSettings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const settings = {
      quality: rawSettings.quality === 'low' ? 'low' : 'high',
      movementAssist:
        typeof rawSettings.movementAssist === 'boolean'
          ? rawSettings.movementAssist
          : defaults.settings.movementAssist,
      cameraShake:
        typeof rawSettings.cameraShake === 'boolean'
          ? rawSettings.cameraShake
          : defaults.settings.cameraShake,
      sfxVolume:
        Number.isFinite(rawSettings.sfxVolume)
          ? Math.max(0, Math.min(100, Math.round(rawSettings.sfxVolume)))
          : defaults.settings.sfxVolume,
      bgmVolume:
        Number.isFinite(rawSettings.bgmVolume)
          ? Math.max(0, Math.min(100, Math.round(rawSettings.bgmVolume)))
          : defaults.settings.bgmVolume,
      muted:
        typeof rawSettings.muted === 'boolean' ? rawSettings.muted : defaults.settings.muted
    };

    const rawStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    const stats = {
      matchesPlayed:
        Number.isFinite(rawStats.matchesPlayed) && rawStats.matchesPlayed >= 0
          ? Math.floor(rawStats.matchesPlayed)
          : 0,
      matchesWon:
        Number.isFinite(rawStats.matchesWon) && rawStats.matchesWon >= 0
          ? Math.floor(rawStats.matchesWon)
          : 0,
      totalPointsWon:
        Number.isFinite(rawStats.totalPointsWon) && rawStats.totalPointsWon >= 0
          ? Math.floor(rawStats.totalPointsWon)
          : 0,
      totalPerfectShots:
        Number.isFinite(rawStats.totalPerfectShots) && rawStats.totalPerfectShots >= 0
          ? Math.floor(rawStats.totalPerfectShots)
          : 0,
      totalAces:
        Number.isFinite(rawStats.totalAces) && rawStats.totalAces >= 0
          ? Math.floor(rawStats.totalAces)
          : 0
    };

    return {
      version: SAVE_SCHEMA_VERSION,
      xp,
      level,
      coins,
      unlockedCharacters,
      selectedCharacter,
      selectedDifficulty,
      settings,
      stats
    };
  }

  load() {
    try {
      const rawStr = window.localStorage.getItem(this.storageKey);
      if (!rawStr) {
        this.data = this.getDefaultData();
        this.syncRosterUnlocks();
        this.save();
        return this.data;
      }
      const parsed = JSON.parse(rawStr);
      this.data = this.sanitize(parsed);
      this.syncRosterUnlocks();
      this.save();
    } catch (_err) {
      // Corrupted JSON or unavailable storage -> fallback safely to defaults
      this.data = this.getDefaultData();
      this.syncRosterUnlocks();
      this.save();
    }
    return this.data;
  }

  save() {
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (_err) {
      // Ignore storage quota errors in restricted environments
    }
    return this.data;
  }

  resetSave() {
    this.data = this.getDefaultData();
    this.syncRosterUnlocks();
    this.save();
    return this.data;
  }

  syncRosterUnlocks() {
    const unlocked = new Set(this.data.unlockedCharacters);
    for (const [id, profile] of Object.entries(CHARACTER_ROSTER)) {
      if (profile.unlockLevel <= this.data.level) {
        unlocked.add(id);
      }
      profile.unlocked = unlocked.has(id);
    }
    this.data.unlockedCharacters = Array.from(unlocked);
  }

  isCharacterUnlocked(charId) {
    return this.data.unlockedCharacters.includes(charId);
  }

  unlockCharacter(charId) {
    if (!CHARACTER_ROSTER[charId]) return false;
    if (!this.data.unlockedCharacters.includes(charId)) {
      this.data.unlockedCharacters.push(charId);
    }
    CHARACTER_ROSTER[charId].unlocked = true;
    this.save();
    return true;
  }

  setSelectedCharacter(charId) {
    if (CHARACTER_ROSTER[charId] && this.isCharacterUnlocked(charId)) {
      this.data.selectedCharacter = charId;
      this.save();
      return true;
    }
    return false;
  }

  setSelectedDifficulty(level) {
    if (['easy', 'normal', 'hard'].includes(level)) {
      this.data.selectedDifficulty = level;
      this.save();
      return true;
    }
    return false;
  }

  updateSettings(partial = {}) {
    this.data.settings = {
      ...this.data.settings,
      ...partial
    };
    this.data = this.sanitize(this.data);
    this.save();
    return this.data.settings;
  }

  getXpProgress() {
    const xpIntoLevel = this.data.xp % XP_PER_LEVEL;
    return {
      level: this.data.level,
      totalXp: this.data.xp,
      xpIntoLevel,
      xpRequired: XP_PER_LEVEL,
      progressPct: Math.min(100, Math.round((xpIntoLevel / XP_PER_LEVEL) * 100))
    };
  }

  /**
   * Awards match XP and Coins, computes level ups, and unlocks eligible characters.
   */
  recordMatchResult({
    won = false,
    difficulty = 'normal',
    playerPoints = 0,
    perfectShots = 0,
    aces = 0
  } = {}) {
    const oldLevel = this.data.level;
    const prevUnlocked = new Set(this.data.unlockedCharacters);

    const diffMult = difficulty === 'hard' ? 1.5 : difficulty === 'normal' ? 1.2 : 1.0;
    const baseXp = won ? 75 : 35;
    const perfXp = playerPoints * 4 + perfectShots * 8 + aces * 12;
    const xpEarned = Math.round((baseXp + perfXp) * diffMult);
    const coinsEarned = (won ? 50 : 20) + perfectShots * 5 + aces * 10;

    this.data.xp += xpEarned;
    this.data.coins += coinsEarned;
    this.data.level = Math.floor(this.data.xp / XP_PER_LEVEL) + 1;

    this.data.stats.matchesPlayed += 1;
    if (won) {
      this.data.stats.matchesWon += 1;
    }
    this.data.stats.totalPointsWon += playerPoints;
    this.data.stats.totalPerfectShots += perfectShots;
    this.data.stats.totalAces += aces;

    this.syncRosterUnlocks();
    this.save();

    const newlyUnlockedCharacters = this.data.unlockedCharacters
      .filter((id) => !prevUnlocked.has(id))
      .map((id) => CHARACTER_ROSTER[id]?.name || id);

    const progress = this.getXpProgress();

    return {
      xpEarned,
      coinsEarned,
      oldLevel,
      newLevel: this.data.level,
      leveledUp: this.data.level > oldLevel,
      newlyUnlockedCharacters,
      ...progress
    };
  }
}
