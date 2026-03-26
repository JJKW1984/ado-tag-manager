module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/src/test/setupTests.ts"],
  testMatch: ["**/?(*.)+(spec|test).+(ts|tsx)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "\\.(css|scss)$": "identity-obj-proxy",
    "\\.(png|jpg|jpeg|gif|svg)$": "<rootDir>/src/test/mocks/fileMock.js",
    "^azure-devops-ui/.+$": "<rootDir>/src/test/mocks/modules/azureDevopsUi.tsx",
    "^azure-devops-extension-api/WorkItemTracking$": "<rootDir>/src/test/mocks/modules/azureDevopsApiWorkItemTracking.ts",
    "^azure-devops-extension-api/Core/CoreClient$": "<rootDir>/src/test/mocks/modules/azureDevopsApiCoreClient.ts",
    "^azure-devops-extension-api/Common/CommonServices$": "<rootDir>/src/test/mocks/modules/azureDevopsApiCommonServices.ts"
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json"
      }
    ]
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/test/**"
  ],
  coverageDirectory: "coverage",
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-results",
        outputName: "junit.xml"
      }
    ]
  ]
};
