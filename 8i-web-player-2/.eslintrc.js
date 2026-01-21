module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: [
    "import",
    "@typescript-eslint",
    "react",
    // "react-hooks",
    "jest",
    "prettier",
    // "@react-three",
  ],
  env: {
    browser: true,
    es2021: true,
    jest: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.eslint.json"],
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
  ],
  rules: {
    // turn on errors for missing imports
    "import/no-unresolved": "error",
    "no-console": "error",
    "react/prop-types": 0,
    "react/display-name": "off",
  },
  settings: {
    // See https://www.npmjs.com/package/eslint-import-resolver-typescript#configuration
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        // use a glob pattern
        project: "packages/*/tsconfig.json",
      },
    },
  },
};
