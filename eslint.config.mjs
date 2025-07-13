import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import pluginJest from 'eslint-plugin-jest';
import prettier from 'eslint-config-prettier'


export default defineConfig([
  {
    ignores: ['src/generated/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      jest: pluginJest,
    },
    rules: {
      ...pluginJest.configs.recommended.rules,
      ...pluginJest.configs.style.rules,
    },
  },
  js.configs.recommended,
  prettier,
]);