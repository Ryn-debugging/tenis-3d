/**
 * TouchController
 * Manages right-side mobile action buttons (HIT, POWER, LOB, SMASH, SERVE)
 * using Pointer Events with independent multi-touch pointer tracking.
 */
export class TouchController {
  constructor(callbacks = {}) {
    this.onAction = callbacks.onAction || (() => {});
    this.onPauseToggle = callbacks.onPauseToggle || (() => {});

    this.buttons = {
      hit: document.getElementById('btn-hit'),
      power: document.getElementById('btn-power'),
      lob: document.getElementById('btn-lob'),
      smash: document.getElementById('btn-smash'),
      serve: document.getElementById('btn-serve'),
      pause: document.getElementById('btn-pause')
    };

    this.serveLabelEl = document.getElementById('btn-serve-label');
    this.serveSubEl = document.getElementById('btn-serve-sub');
    this.smashSubEl = document.getElementById('btn-smash-sub');
    this.powerSubEl = document.getElementById('btn-power-sub');

    this.isSmashReady = false;
    this.isPowerReady = true;
    this.matchState = 'SERVE_WAIT';
    this.isPlayerServing = true;

    this.bindButtonEvents();
  }

  bindButtonEvents() {
    const actionMap = [
      { el: this.buttons.hit, action: 'NORMAL' },
      { el: this.buttons.power, action: 'POWER' },
      { el: this.buttons.lob, action: 'LOB' },
      { el: this.buttons.smash, action: 'SMASH' },
      { el: this.buttons.serve, action: 'SERVE' }
    ];

    actionMap.forEach(({ el, action }) => {
      if (!el) return;

      el.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          // If SMASH is tapped when ball is not in a valid smash position, reject & shake
          if (action === 'SMASH' && !this.isSmashReady) {
            el.classList.remove('btn-denied-shake');
            void el.offsetWidth;
            el.classList.add('btn-denied-shake');
            this.onAction('SMASH_INVALID');
            return;
          }

          // If POWER is tapped when player energy is insufficient, reject & shake
          if (action === 'POWER' && !this.isPowerReady) {
            el.classList.remove('btn-denied-shake');
            void el.offsetWidth;
            el.classList.add('btn-denied-shake');
            this.onAction('POWER_LOW_ENERGY');
            return;
          }

          el.classList.add('btn-pressed');
          try {
            el.setPointerCapture(e.pointerId);
          } catch (_) {
            // Ignore synthetic pointers without capture support
          }

          this.onAction(action);
        },
        { passive: false }
      );

      const releaseHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('btn-pressed');
      };

      el.addEventListener('pointerup', releaseHandler, { passive: false });
      el.addEventListener('pointercancel', releaseHandler, { passive: false });
      el.addEventListener('lostpointercapture', releaseHandler, { passive: false });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    if (this.buttons.pause) {
      this.buttons.pause.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.buttons.pause.classList.add('btn-pressed');
          this.onPauseToggle();
        },
        { passive: false }
      );

      const releasePause = (e) => {
        e.preventDefault();
        this.buttons.pause.classList.remove('btn-pressed');
      };
      this.buttons.pause.addEventListener('pointerup', releasePause, { passive: false });
      this.buttons.pause.addEventListener('pointercancel', releasePause, { passive: false });
      this.buttons.pause.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  /**
   * Synchronizes button visibility, labels, and active/disabled states with live match context.
   */
  updateContext({ matchState, isPlayerServing, isSmashReady, isPowerReady = true }) {
    this.matchState = matchState;
    this.isPlayerServing = isPlayerServing;
    this.isSmashReady = Boolean(isSmashReady);
    this.isPowerReady = Boolean(isPowerReady);

    const showServeBtn =
      (matchState === 'SERVE_WAIT' || matchState === 'SERVE_TOSS') && isPlayerServing;

    if (this.buttons.serve) {
      if (showServeBtn) {
        this.buttons.serve.classList.remove('hidden');
        if (matchState === 'SERVE_TOSS') {
          this.buttons.serve.classList.add('serve-toss-active');
          if (this.serveLabelEl) this.serveLabelEl.textContent = 'STRIKE!';
          if (this.serveSubEl) this.serveSubEl.textContent = 'APEX TIMING';
        } else {
          this.buttons.serve.classList.remove('serve-toss-active');
          if (this.serveLabelEl) this.serveLabelEl.textContent = 'SERVE';
          if (this.serveSubEl) this.serveSubEl.textContent = 'TAP TO TOSS';
        }
      } else {
        this.buttons.serve.classList.add('hidden');
        this.buttons.serve.classList.remove('serve-toss-active');
      }
    }

    // Dim secondary rally buttons while waiting to serve
    const inRally = matchState === 'RALLY';
    if (this.buttons.lob) {
      this.buttons.lob.classList.toggle('btn-context-dim', !inRally);
    }

    // Update POWER button state based on Power Energy availability
    if (this.buttons.power) {
      this.buttons.power.classList.toggle('btn-context-dim', !inRally && this.isPowerReady);
      if (this.isPowerReady) {
        this.buttons.power.classList.remove('power-depleted');
        this.buttons.power.setAttribute('aria-disabled', 'false');
        if (this.powerSubEl) this.powerSubEl.textContent = 'DRIVE';
      } else {
        this.buttons.power.classList.add('power-depleted');
        this.buttons.power.setAttribute('aria-disabled', 'true');
        if (this.powerSubEl) this.powerSubEl.textContent = 'LOW ENRG';
      }
    }

    // Update SMASH button state (only works when ball is in a valid high smash position)
    if (this.buttons.smash) {
      if (inRally && this.isSmashReady) {
        this.buttons.smash.classList.add('smash-ready');
        this.buttons.smash.classList.remove('smash-disabled');
        this.buttons.smash.setAttribute('aria-disabled', 'false');
        if (this.smashSubEl) this.smashSubEl.textContent = 'READY!';
      } else {
        this.buttons.smash.classList.remove('smash-ready');
        this.buttons.smash.classList.add('smash-disabled');
        this.buttons.smash.setAttribute('aria-disabled', 'true');
        if (this.smashSubEl) this.smashSubEl.textContent = 'HIGH BALL';
      }
    }
  }
}
