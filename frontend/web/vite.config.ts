import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  // Backend CORS and Sanctum stateful domains expect exactly localhost:5173.
  server: { host: 'localhost', port: 5173, strictPort: true },
})
