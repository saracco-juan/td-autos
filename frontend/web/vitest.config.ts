import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Coverage matches files outside the project root by absolute path.
const sharedDir = fileURLToPath(new URL('../shared', import.meta.url))

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: false,
      css: false,
      // The shared module (frontend/shared) has no runner of its own; its unit tests run here.
      include: [...configDefaults.include, '../shared/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        // lcov feeds SonarQube Cloud; text is for the terminal and CI logs.
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}', `${sharedDir}/**/*.ts`],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', `${sharedDir}/**/*.test.ts`],
        // frontend/shared sits outside this project root.
        allowExternal: true,
      },
    },
  }),
)
