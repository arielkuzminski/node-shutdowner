import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  // Browser script: globals are checked by tsc (checkJs + DOM lib) instead.
  { files: ['public/**/*.js'], rules: { 'no-undef': 'off' } },
);
