import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { api } from "@/core/api";

/** Universal/App Links (https://ilumie.com/llds/app/…) opened in the native app: magic-link tokens become a session,
 *  anything else is ignored (the app always starts on Home). Also handles the cold-start URL. */
export function initDeepLinks() {
  if (!Capacitor.isNativePlatform()) return;
  const handle = (url: string | undefined) => { if (url) void api.handleAuthUrl(url).catch(() => undefined); };
  void App.addListener("appUrlOpen", (e) => handle(e.url));
  void App.getLaunchUrl().then((l) => handle(l?.url)).catch(() => undefined);
}
