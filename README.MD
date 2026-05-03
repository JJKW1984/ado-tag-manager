# TagTidy for Azure Boards

Developer guide for building, testing, packaging, and publishing the TagTidy Azure DevOps extension.

For Marketplace listing content, see `overview.md`.

## What This Repository Contains

- Production manifest: `vss-extension.json`
- Development manifest: `vss-extension-dev.json`
- Extension UI and logic: `src/`
- Static assets: `static/`
- Webpack output: `dist/`

## Features

- View all tags in your Azure DevOps organization with work item counts
- Rename a tag inline across all matching work items
- Merge one or more tags into a target tag
- Delete one or more tags from all matching work items
- Search and filter tags by name or first letter (A–Z)
- Preview impacted work item count before applying changes
- Background tag count cache with 24-hour refresh

## Tech Stack

- Azure DevOps Extension SDK v4.2.0
- Azure DevOps Extension API v4.270.0 (Work Item Tracking)
- Azure DevOps UI v2.272.0
- React 16
- TypeScript 5
- Node.js tooling (pnpm, webpack, jest)

## Repository Structure

```text
.
|-- src/
|   |-- app/          # React components (TagManagerApp, TagTable, dialogs, etc.)
|   |-- hub/          # Extension entry point (Hub.tsx, Hub.html)
|   |-- services/     # Tag API and count cache services
|   |-- types/        # TypeScript interfaces
|   `-- utils/        # Input validation and error helpers
|-- static/           # Static assets bundled into dist/
|-- dist/             # Webpack build output
|-- vss-extension.json
|-- vss-extension-dev.json
|-- package.json
|-- tsconfig.json
`-- README.MD
```

## Prerequisites

Install the following before local development:

1. Node.js 20+ (LTS recommended)
2. pnpm
3. Azure DevOps organization for extension testing
4. Azure DevOps Personal Access Token (PAT) for publishing
5. Visual Studio Marketplace publisher account

## Development Environment Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/<your-org>/ado-tag-manager.git
cd ado-tag-manager
pnpm install
```

### 2. Build and run locally

Use project scripts during development:

```bash
pnpm build
pnpm dev
```

### 3. Configure environment variables

Create a local `.env` file (do not commit secrets):

```env
AZDO_ORG_URL=https://dev.azure.com/<your-org>
AZDO_PAT=<your_pat>
AZDO_PUBLISHER_ID=<your_marketplace_publisher_id>
```

Recommended PAT scopes for publishing and testing:
- Marketplace (Manage)
- Extension management
- Work Items (Read & Write)
- Analytics (Read)

### 4. Run tests

```bash
pnpm test
pnpm test:coverage
```

## Azure DevOps Extension Manifest

The extension definition lives in `vss-extension.json`.

Use `vss-extension-dev.json` for private pre-release validation.

At minimum, keep these fields accurate:
- `id`
- `name`
- `publisher`
- `version`
- `targets`
- `contributions`

When shipping updates, always bump `version`.

## Script Reference

- `pnpm build`: Create production bundle in `dist/`
- `pnpm dev`: Run webpack dev server (port 3000, HTTPS)
- `pnpm test`: Run Jest tests
- `pnpm test:watch`: Run Jest in watch mode
- `pnpm test:coverage`: Run tests with coverage output
- `pnpm package`: Package production manifest (`vss-extension.json`)
- `pnpm manifest:test`: Regenerate development manifest (`vss-extension-dev.json`)
- `pnpm package:test`: Package development manifest (`vss-extension-dev.json`)

## Tag Operation Design Notes

Tag operations are implemented through the Work Item Tracking APIs by updating the `System.Tags` field on affected work items.

- Dry-run preview: impacted work item count is shown before changes are applied
- Idempotent operations: running the same operation twice does not corrupt tags
- Conflict handling: duplicate tags within a single item are prevented
- Tag counts are cached via the Azure Analytics OData API and refreshed in the background

## Packaging the Extension

Build and package the production extension:

```bash
pnpm build
npx tfx extension create --manifest-globs vss-extension.json
```

This produces a `.vsix` package.

## Publish the Extension

Publish the production extension:

```bash
npx tfx extension publish \
  --manifest-globs vss-extension.json \
  --publisher "$AZDO_PUBLISHER_ID" \
  --token "$AZDO_PAT"
```

## Private Pre-Release Testing Workflow

Use the development manifest for private validation before production updates.

This repository supports a separate development extension ID so it can coexist with production:
- Production extension ID: `ado-tag-manager`
- Development extension ID: `ado-tag-manager-develop`

Generate and package the development variant:

```bash
pnpm build
pnpm manifest:test
pnpm package:test
```

Publish the development variant:

```bash
npx tfx extension publish \
  --manifest-globs vss-extension-dev.json \
  --publisher "$AZDO_PUBLISHER_ID" \
  --token "$AZDO_PAT"
```

What this does:
- Creates `vss-extension-dev.json` from the base manifest
- Marks the test variant as `public: false` and `galleryFlags: ["Preview"]`
- Suffixes contribution IDs so the test variant can coexist safely

Recommended rollout:
1. Publish private variant to a test organization/canary org.
2. Validate core scenarios (merge, rename, delete, count, paging, alpha filter).
3. Publish public extension only after private validation passes.

## Continuous Integration Quality Gates

The repository includes an Azure Pipelines definition in `azure-pipelines.yml`.

Pipeline gates:
- Install dependencies with `pnpm install --frozen-lockfile`
- Build with `pnpm build`
- Run tests with coverage via `pnpm test:coverage`
- Publish JUnit test results (`test-results/junit.xml`)
- Publish Cobertura coverage (`coverage/cobertura-coverage.xml`)

## Update an Existing Extension

For every update:

1. Update code and tests
2. Bump version in `vss-extension.json` (semantic versioning recommended)
3. Rebuild and republish

```bash
pnpm build
npx tfx extension publish \
  --manifest-globs vss-extension.json \
  --publisher "$AZDO_PUBLISHER_ID" \
  --token "$AZDO_PAT"
```

If an installed extension does not update as expected:
- Verify version was incremented
- Confirm publish succeeded to the same publisher/id
- Re-check organization sharing/install permissions

## Security and Safety

- Never commit PATs or secrets
- Use least-privilege PAT scopes
- Validate tag name input before applying bulk updates
- Prefer preview + confirmation for destructive actions (especially delete)

## Contributing

1. Create a feature branch
2. Implement and test changes
3. Open a pull request with clear before/after behavior

## License

MIT
