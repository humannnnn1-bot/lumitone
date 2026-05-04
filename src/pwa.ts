export const PWA_UPDATE_READY_EVENT = "chromalum:pwa-update-ready";

export interface PwaUpdateReadyDetail {
  registration: ServiceWorkerRegistration;
}

function dispatchUpdateReady(registration: ServiceWorkerRegistration): void {
  window.dispatchEvent(new CustomEvent<PwaUpdateReadyDetail>(PWA_UPDATE_READY_EVENT, { detail: { registration } }));
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
      const swUrl = new URL("sw.js", baseUrl);
      const registration = await navigator.serviceWorker.register(swUrl);
      let notifiedWorker: ServiceWorker | null = null;

      const notifyOnce = () => {
        if (!registration.waiting || registration.waiting === notifiedWorker || !navigator.serviceWorker.controller) return;
        notifiedWorker = registration.waiting;
        dispatchUpdateReady(registration);
      };

      notifyOnce();
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") window.setTimeout(notifyOnce, 0);
        });
      });
    } catch (err) {
      console.warn("CHROMALUM: service worker registration failed", err);
    }
  };

  if (document.readyState === "complete") {
    void register();
  } else {
    window.addEventListener("load", () => void register(), { once: true });
  }
}
