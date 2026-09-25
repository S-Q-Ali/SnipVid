import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: [".next/**", "coverage/**", "node_modules/**", "storage/**"],
  },
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  {
    files: ["**/*.ts", "**/*.tsx"],
  },
];

export default eslintConfig;
