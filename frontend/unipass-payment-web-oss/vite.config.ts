import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// NOTE: Once `frontend/unipass-wallet-js-oss` is linked into the pnpm
// workspace, change this alias to the package name.
export default defineConfig({ plugins: [react()] });
