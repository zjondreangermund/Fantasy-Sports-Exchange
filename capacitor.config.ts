import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fantasyfc.app",
  appName: "FantasyFC",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    url: "https://fantasy-sports-exchange-production-b10a.up.railway.app",
    cleartext: false,
  },
};

export default config;
