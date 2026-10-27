import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        // Os testes E2E (Playwright) rodam com `npm run test:e2e`, não com o Vitest.
        exclude: [...configDefaults.exclude, "e2e/**"],
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
        globals: true,
    },
});
