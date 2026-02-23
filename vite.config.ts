import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "TelegramGateway",
      formats: ["es", "cjs"],
      fileName: "telegram-gateway",
    },
    rollupOptions: {
      external: ["crypto"],
    },
  },
});
