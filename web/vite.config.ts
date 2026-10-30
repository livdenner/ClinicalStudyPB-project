import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
        globals: true,
        // Testes de tela com popovers do HeroUI passam de 5 s quando a suíte roda em paralelo.
        testTimeout: 15_000,
    },
});
