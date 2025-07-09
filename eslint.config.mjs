import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import pluginJest from 'eslint-plugin-jest';
import prettier from 'eslint-config-prettier'


export default defineConfig([
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
    extends: ['plugin:jest/recommended', 'plugin:jest/style'],
  },
  js.configs.recommended,
  prettier,
]);