/** @type {import("jest").Config} */
module.exports = {
  clearMocks: true,
  collectCoverage: false,
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  silent: true,
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.contract-spec.ts"],
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
};
