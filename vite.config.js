import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: { target: "es2022" },
  server: {
    port: 3000,
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "^/s/[^/]+/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "^/demo/[^/]+/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "/uploads": { target: "http://127.0.0.1:3001", changeOrigin: false },
    },
  },
  resolve: {
    extensions: [".jsx", ".js", ".json"],
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
