import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async () => {
  const isProd = process.env.NODE_ENV === "production";
  const isReplit = process.env.REPL_ID !== undefined;

  const replitPlugins =
    !isProd && isReplit
      ? [
          (await import("@replit/vite-plugin-cartographer")).cartographer(),
          (await import("@replit/vite-plugin-dev-banner")).devBanner(),
        ]
      : [];

  return {
    plugins: [react(), runtimeErrorOverlay(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,

      // Optional: raises the warning threshold (doesn't change output)
      chunkSizeWarningLimit: 900,

      // Helps split the big bundle
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],

            // Your UI / common libs tend to be big
            radix: [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
            ],

            // If you actually use these, they can be huge
            three: ["three", "@react-three/fiber", "@react-three/drei"],

            charts: ["recharts"],
            motion: ["framer-motion"],
            forms: ["react-hook-form", "@hookform/resolvers"],
          },
        },
      },
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
