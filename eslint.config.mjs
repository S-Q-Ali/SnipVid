import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "storage/**",
      "components/header/header.tsx",
      "lib/downloader/service.ts",
      "lib/ffmpeg/service.ts",
    ],
  },
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  {
    files: ["**/*.ts", "**/*.tsx"],
  },
];

export default eslintConfig;
