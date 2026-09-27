import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    css: false,
    passWithNoTests: true,
    // Runs before each test file's imports, so the service module reads it.
    setupFiles: ["./test/temp-root-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "lib/instagram/**/*.ts",
        "lib/security/**/*.ts",
        "app/api/instagram/**/*.ts",
        "app/api/download/**/*.ts",
        "app/api/health/**/*.ts",
      ],
      exclude: ["**/__tests__/**", "**/*.test.ts", "**/types.ts"],
    },
  },
});
