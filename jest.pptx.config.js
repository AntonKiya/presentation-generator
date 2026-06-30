/** @type {import("jest").Config} */
module.exports = {
  ...require("./jest.contracts.config"),
  testMatch: ["<rootDir>/src/presentation-export/__tests__/pptx-*.contract-spec.ts"],
};
