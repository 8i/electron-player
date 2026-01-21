// eslint.config.js
module.exports = [
  {
    files: ["**/*.ts", "**/*.js", "**.*.tsx", "**.*.jsx"],
    ignores: [
      "contrib",
      "node_modules",
      "dist",
      "jest.config.js",
      "assets",
      ".eslintrc.js",
    ],
  },
];
