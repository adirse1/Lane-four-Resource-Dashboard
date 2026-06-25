import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // In live mode (npm run dev:live), /api/* is forwarded to the SF proxy.
    proxy: { "/api": "http://localhost:8787" },
  },
});
