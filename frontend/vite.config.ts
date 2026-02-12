import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// 开发环境下将 /api 代理到本地 Worker
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      }
    }
  }
});

