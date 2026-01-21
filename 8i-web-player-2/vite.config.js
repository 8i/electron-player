import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative paths for Electron file:// protocol compatibility
  base: './',
  resolve: {
    alias: {
      dashjs: "/node_modules/dashjs/dist/dash.all.min.js",
    },
  },
  plugins: [glsl()],
});
