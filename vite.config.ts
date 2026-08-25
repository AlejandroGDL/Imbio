import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/

// Modo LAN: cuando LAN=true, Vite escucha en 0.0.0.0 para que otras PCs
// en la red puedan abrir el frontend. Útil para desarrollo multi-PC.
// Uso: LAN=1 npm run dev:lan
const LAN_MODE = process.env.LAN === "1" || process.env.LAN === "true";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri expects a fixed port, fail if that port is not available
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // En modo LAN escucha en todas las interfaces; en Tauri (default) solo localhost
    host: LAN_MODE ? "0.0.0.0" : false,
    hmr: LAN_MODE
      ? {
          // HMR por LAN: usa el host LAN por defecto de Vite
          protocol: "ws",
        }
      : {
          protocol: "ws",
          host: "localhost",
          port: 1421,
        },
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
});
