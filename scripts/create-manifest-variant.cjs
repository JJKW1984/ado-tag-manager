#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const variant = process.argv[2];

if (variant !== "test") {
  console.error("Usage: node scripts/create-manifest-variant.cjs test");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const baseManifestPath = path.join(root, "vss-extension.json");
const outManifestPath = path.join(root, "vss-extension-dev.json");

const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, "utf8"));

const testManifest = {
  ...baseManifest,
  id: `${baseManifest.id}-develop`,
  name: `${baseManifest.name} (Develop)`,
  public: false,
  galleryFlags: ["Preview"],
  contributions: Array.isArray(baseManifest.contributions)
    ? baseManifest.contributions.map((contribution) => ({
        ...contribution,
        id: `${contribution.id}-develop`,
      }))
    : baseManifest.contributions,
};

fs.writeFileSync(outManifestPath, `${JSON.stringify(testManifest, null, 2)}\n`, "utf8");

console.log(`Wrote ${path.basename(outManifestPath)} for private testing.`);
