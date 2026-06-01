import { Platform } from 'react-native';

// On web, inject the PWA head tags and register the service worker.
// No-op on native. Safe to call once at app startup.

const BASE = '/workout-app';

export function initPwa(): void {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;

  const head = document.head;

  const addLink = (rel: string, href: string) => {
    if (head.querySelector(`link[rel="${rel}"]`)) return;
    const l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    head.appendChild(l);
  };

  const addMeta = (name: string, content: string) => {
    if (head.querySelector(`meta[name="${name}"]`)) return;
    const m = document.createElement('meta');
    m.name = name;
    m.content = content;
    head.appendChild(m);
  };

  addLink('manifest', `${BASE}/manifest.json`);
  addLink('apple-touch-icon', `${BASE}/icon.png`);
  addMeta('apple-mobile-web-app-capable', 'yes');
  addMeta('mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  addMeta('apple-mobile-web-app-title', 'Stadium');
  addMeta('theme-color', '#0E0F12');

  // Edge-to-edge so iOS standalone exposes safe-area insets to the layout.
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) {
    vp.setAttribute(
      'content',
      'width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no',
    );
  }

  if ('serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker
        .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
        .catch(() => {});
    };
    // initPwa runs in a useEffect after React mounts, so the window 'load'
    // event has typically already fired by now and a 'load' listener would
    // never run. Register immediately if the document is already loaded.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }
}
