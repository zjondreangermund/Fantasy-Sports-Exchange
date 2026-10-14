import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fantasyfc.app",
  appName: "Fantasy Arena",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    url: "https://playfantasyarena.com",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
