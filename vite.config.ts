import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// RELEASE=1 strips the internal test menu and version banner out of the bundle.
const isRelease = process.env.RELEASE === "1" || process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: {
    __RELEASE__: JSON.stringify(isRelease),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
  },
  build: { target: "es2022", sourcemap: false },
  server: { port: 5173, host: true },
});
