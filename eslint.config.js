import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Pages reset form/loading state in effects; this newer advisory rule flags
      // that pattern. Kept visible as a warning rather than rewriting stable screens.
      'react-hooks/set-state-in-effect': 'warn',
      // authContext exports the provider together with its useAuth hook.
      'react-refresh/only-export-components': ['error', { allowConstantExport: true, allowExportNames: ['useAuth'] }],
    },
  },
  {
    // build config and database test scripts run in Node
    files: ['vite.config.js', 'db/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
])
