import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tsconfigPaths()],
	server: {
		proxy: {
			// Avoid CORS during local dev; server defaults to localhost:8080 (.env.template)
			"/square-root": {
				target: process.env.VITE_DEV_PROXY_TARGET ?? "http://localhost:8080",
				changeOrigin: true,
			},
		},
	},
});
