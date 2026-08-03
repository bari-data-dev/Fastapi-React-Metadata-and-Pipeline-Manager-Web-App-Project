// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const SERVER_IP = "192.100.38.67"; // ganti sesuai IP server kamu

export default defineConfig(({ mode }) => ({
  server: {
    host: true,            // alias 0.0.0.0 / bind ke semua interface (lebih andal daripada "::")
    port: 8080,
    hmr: {
      host: SERVER_IP,     // penting supaya HMR websocket menghubungkan ke IP publik server
      protocol: "ws",
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
