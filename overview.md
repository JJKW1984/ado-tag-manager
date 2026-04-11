# ADO Tag Manager

ADO Tag Manager is an Azure DevOps extension for cleaning up and standardizing Azure Boards tags across large work item sets.

It is designed for teams that need safe, repeatable tag maintenance without manual edits item-by-item.

## Marketplace Summary

Clean up Azure Boards tags safely: merge duplicates, rename tags, and delete obsolete tags across work items.

## What It Does

This extension provides a management UI and API-backed operations to:

- Merge tags
- Rename tags
- Delete tags

## Typical Use Cases

- Standardize inconsistent tags (frontend, front-end, ui)
- Consolidate duplicate tag taxonomies after team merges
- Remove stale tags no longer used for planning or reporting
- Keep board filters and dashboards consistent over time

## Required Permissions

The extension requests the following Azure DevOps scopes:

- vso.work (read work item data)
- vso.work_write (update work item tags)

These permissions are required for bulk tag maintenance operations.

## Getting Started

1. Install the extension from the Azure DevOps Marketplace.
2. Open Azure Boards and navigate to the Tag Manager hub.
3. Choose an operation (merge, rename, or delete).
4. Validate the expected impact and apply the change.

## Safety Model

- Built for organization-level governance workflows
- Uses Azure DevOps Work Item Tracking APIs
- Intended for controlled, auditable tag updates

## Operational Guidance

- Start with a small, low-risk tag update in your test project.
- Standardize a tag naming convention before bulk operations.
- Coordinate large updates with project admins to avoid confusion during active sprint planning.

## Compatibility

- Azure DevOps Services
- Azure Boards and Azure Test Plans contexts

## Support

- Source code: https://github.com/JJKW1984/ado-tag-manager
- Issues and support: https://github.com/JJKW1984/ado-tag-manager/issues
