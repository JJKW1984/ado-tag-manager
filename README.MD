# ADO Tag Manager

Azure DevOps extension for managing organization board/work item tags at scale.

This project provides a management UI and API-backed operations to:
- Merge tags
- Rename tags
- Delete tags

The extension is built with the Azure DevOps Extension SDK and interacts with Azure DevOps APIs to perform safe, auditable tag maintenance across work items.

## Why This Extension

As organizations grow, tag sprawl creates reporting and board filtering issues. This extension helps administrators and project maintainers:
- Consolidate duplicate tags (`frontend`, `front-end`, `ui`)
- Standardize naming conventions
- Remove obsolete tags

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
2. npm 10+
3. Azure DevOps organization where you can install private extensions
4. Azure DevOps Personal Access Token (PAT) for publishing
5. A publisher created in Visual Studio Marketplace

## Development Environment Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/<your-org>/ado-tag-manager.git
cd ado-tag-manager
npm install
```

### 2. Install global tooling

`tfx-cli` is used to package and publish Azure DevOps extensions.

```bash
npm install -g tfx-cli
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

### 4. Build and run locally

Use your project scripts (example):

```bash
npm run build
npm run dev
```

If you add a local dev server, ensure the extension manifest points to the correct development asset URLs.

## Azure DevOps Extension Manifest

The extension definition lives in `vss-extension.json`.

At minimum, keep these fields accurate:
- `id`
- `name`
- `publisher`
- `version`
- `targets`
- `contributions`

When shipping updates, always bump `version`.

## Tag Operation Design Notes

Tag operations should be implemented through the Work Item Tracking APIs by updating the `System.Tags` field on affected work items.

Recommended behavior:
- Dry-run preview: show impacted work item count before changes
- Idempotent operations: running the same operation twice should not corrupt tags
- Conflict handling: avoid creating duplicate tags in a single item
- Auditability: log or summarize changed items

## Packaging the Extension

Build and package:

```bash
npm run build
tfx extension create --manifest-globs vss-extension.json
```

This produces a `.vsix` package.

## Publish the Extension

Publish privately first:

```bash
tfx extension publish \
	--manifest-globs vss-extension.json \
	--publisher "$AZDO_PUBLISHER_ID" \
	--token "$AZDO_PAT"
```

Then share/install the extension to your Azure DevOps organization from the Marketplace management UI.

## Private Pre-Release Testing Workflow

Use a private test variant before publishing the public extension update.

This repository supports a generated test manifest with a different extension ID:
- Base extension ID: `ado-tag-manager`
- Test extension ID: `ado-tag-manager-develop`

Generate and package the private test variant:

```bash
npm run build
npm run package:test
```

Publish the private test variant:

```bash
npm run publish:test
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
- Install dependencies with `npm ci`
- Build with `npm run build`
- Run tests with coverage via `npm run test:coverage`
- Publish JUnit test results (`test-results/junit.xml`)
- Publish Cobertura coverage (`coverage/cobertura-coverage.xml`)

## Update an Existing Extension

For every update:

1. Update code and tests
2. Bump version in `vss-extension.json` (semantic versioning recommended)
3. Rebuild and republish

```bash
npm run build
tfx extension publish \
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
