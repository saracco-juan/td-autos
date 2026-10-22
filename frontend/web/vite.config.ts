import { fileURLToPath } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// Pure TypeScript shared with the mobile app (frontend/shared), imported as `@shared/...`.
const sharedDir = fileURLToPath(new URL('../shared', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: { '@shared': sharedDir },
  },
  server: {
    // Backend CORS and Sanctum stateful domains expect exactly localhost:5173.
    host: 'localhost',
    port: 5173,
    strictPort: true,
    // The dev server only serves the web folder by default; the shared module lives next to it.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), sharedDir] },
  },
})
