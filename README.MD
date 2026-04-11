# ADO Tag Manager

Developer guide for building, testing, packaging, and publishing the ADO Tag Manager Azure DevOps extension.

For Marketplace listing content, see `overview.md`.

## What This Repository Contains

- Production manifest: `vss-extension.json`
- Development manifest: `vss-extension-dev.json`
- Extension UI and logic: `src/`
- Static assets: `static/`
- Webpack output: `dist/`

## Features

- Merge one tag into another
- Rename a tag across matching work items
- Delete a tag from matching work items
- Preview impact before applying changes (recommended implementation pattern)
- Designed for organization-level governance use cases

## Tech Stack

- Azure DevOps Extension SDK
- Azure DevOps REST APIs (Work Item Tracking)
- TypeScript (recommended)
- Node.js tooling
- azure-devops-extension-sdk:
- azure-devops-extension-api: 
- azure-devops-ui:

## Repository Structure (Suggested)

Use or adapt this structure as the project evolves:

```text
.
|-- src/
|   |-- app/
|   |-- services/
|   `-- types/
|-- static/
|-- vss-extension.json
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
5. Visual Studio Marketplace publisher

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
- `pnpm dev`: Run webpack dev server
- `pnpm test`: Run Jest tests
- `pnpm test:coverage`: Run tests with coverage output
- `pnpm package`: Package production manifest (`vss-extension.json`)
- `pnpm manifest:test`: Regenerate development manifest (`vss-extension-dev.json`)
- `pnpm package:test`: Package development manifest (`vss-extension-dev.json`)

## Tag Operation Design Notes

Tag operations should be implemented through the Work Item Tracking APIs by updating the `System.Tags` field on affected work items.

Recommended behavior:
- Dry-run preview: show impacted work item count before changes
- Idempotent operations: running the same operation twice should not corrupt tags
- Conflict handling: avoid creating duplicate tags in a single item
- Auditability: log or summarize changed items

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
2. Validate core scenarios (merge, delete, count, paging, alpha filter).
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
- Validate tag transformation input before applying bulk updates
- Prefer preview + confirmation for destructive actions (especially delete)

## Contributing

1. Create a feature branch
2. Implement and test changes
3. Open a pull request with clear before/after behavior

## License

Add your license here (for example, MIT).
