import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 120000, // CPU-heavy property runs; generous so machine load cannot fail them
  },
});
