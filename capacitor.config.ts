import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fantasyfc.app",
  appName: "Fantasy Arena",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    url: "https://fantasy-sports-exchange-production-d05c.up.railway.app",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
