import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fantasyarena.app",
  appName: "Fantasy Arena",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    url: "https://fantasy-sports-exchange-production-d05c.up.railway.app",
    cleartext: false,
  },
};

export default config;
