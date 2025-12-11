import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true, // bind to network interfaces
    port: 5173,
    // add your Render host here so Vite accepts requests from that origin
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'farm2market-weh2.onrender.com'
    ],
  },
  build: {
    outDir: 'dist'
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
