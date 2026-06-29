import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import http from "node:http";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves a project site under /<repo>/. The deploy workflow sets
  // VITE_BASE to that path; local dev stays at "/".
  base: process.env.VITE_BASE || "/",
  server: {
    port: 5173,
    open: true,
    // In live mode (npm run dev:live), /api/* is forwarded to the SF proxy.
    // keepAlive:false so Vite opens a fresh socket per request and never reuses
    // one the Node proxy may have closed (the intermittent ECONNRESET that hung
    // multi-request loads like the Actuals tab).
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true, agent: new http.Agent({ keepAlive: false }) },
    },
  },
});
