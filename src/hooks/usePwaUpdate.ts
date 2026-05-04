import { useCallback, useEffect, useState } from "react";

import { PWA_UPDATE_READY_EVENT, type PwaUpdateReadyDetail } from "../pwa";

export function usePwaUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const onUpdateReady = (event: Event) => {
      const detail = (event as CustomEvent<PwaUpdateReadyDetail>).detail;
      if (!detail?.registration) return;
      setRegistration(detail.registration);
      setReloading(false);
    };

    window.addEventListener(PWA_UPDATE_READY_EVENT, onUpdateReady);
    return () => window.removeEventListener(PWA_UPDATE_READY_EVENT, onUpdateReady);
  }, []);

  const reload = useCallback(() => {
    const waitingWorker = registration?.waiting;
    if (!waitingWorker || !("serviceWorker" in navigator)) {
      window.location.reload();
      return;
    }

    setReloading(true);
    let didReload = false;
    const reloadPage = () => {
      if (didReload) return;
      didReload = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadPage, { once: true });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(reloadPage, 4000);
  }, [registration]);

  const dismiss = useCallback(() => {
    setRegistration(null);
  }, []);

  return { hasUpdate: registration !== null, reloading, reload, dismiss };
}
