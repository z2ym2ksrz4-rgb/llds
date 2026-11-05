import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "@/core/api";

/** Register this device for native push (iOS/Android only). Called once the person is approved. Safe to call repeatedly. */
export async function registerPush() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    PushNotifications.addListener("registration", (t) => { void api.savePushToken(t.value, Capacitor.getPlatform() as "ios" | "android"); });
    await PushNotifications.register();
  } catch { /* plugin missing in web build */ }
}
