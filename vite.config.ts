import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: { outDir: "../../dist/web", emptyOutDir: true },
  // `npm run dev` runs the local server on 4748; the UI dev server forwards API calls to it.
  server: { proxy: { "/api": "http://127.0.0.1:4748" } },
});
