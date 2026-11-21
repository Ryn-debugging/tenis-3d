import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { GameManager } from './core/GameManager.js';

async function registerServiceWorker() {
  const isNative = Capacitor.isNativePlatform();
  const pwaStatus = {
    supported: 'serviceWorker' in navigator,
    nativePlatform: isNative,
    registered: false,
    scope: null,
    error: null
  };
  window.__TENNIS_ANGEL_PWA__ = pwaStatus;

  // Inside native Android Capacitor WebView, all assets are bundled locally offline in APK assets.
  // Keep Service Worker registration exclusively for standalone Web / PWA browser mode.
  if (isNative || !pwaStatus.supported) {
    return pwaStatus;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    pwaStatus.registered = true;
    pwaStatus.scope = registration.scope;

    // Safely handle service worker updates
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', () => {
        if (
          installingWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          installingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  } catch (err) {
    pwaStatus.error = err ? String(err.message || err) : 'Registration failed';
  }

  return pwaStatus;
}

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Missing #game-container element');
    return;
  }

  const game = new GameManager(container);
  window.__TENNIS_ANGEL__ = game;
  await game.init();

  if (Capacitor.isNativePlatform()) {
    try {
      await SplashScreen.hide({ fadeOutDuration: 250 });
    } catch (_err) {
      // Ignore splash screen hide errors on non-native fallback
    }
  }

  await registerServiceWorker();
});
