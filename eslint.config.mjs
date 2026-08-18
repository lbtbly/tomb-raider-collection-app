import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "public/sw.js",
      "src/db/migrations/**",
      "playwright-report/**",
      "test-results/**",
      ".claude/**",
      ".forge/**",
      ".orch/**",
      "docs/**",
      "sandbox/**",
    ],
  },
];

export default eslintConfig;
