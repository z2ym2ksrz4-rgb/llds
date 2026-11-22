import type { CapacitorConfig } from "@capacitor/cli";
import app from "./app.config.json";

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.appName,
  webDir: "dist",
  android: { adjustMarginsForEdgeToEdge: "force" },   // Android 15+ edge-to-edge: keep content below the status bar / above the nav bar
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_notify",
      iconColor: app.brandColor,
    },
  },
};

export default config;
