# RSBUILD OS

**Enterprise operating platform — Finance is the first structured domain.**

RSBUILD OS is the evolving application platform for organizing validated business domains, workflows and data under shared foundations for identity, authorization, governance, auditability and controlled integration.

This repository, historically named `rsbuild-finance-app`, is the application base for RSBUILD OS. Its existing history and Finance implementation are preserved. The repository slug remains unchanged during the transition to avoid breaking deployment and integration references.

## Product scope

- **Platform:** workspace, identity integration, organization membership, authorization enforcement, application workflows and shared operational capabilities.
- **Finance:** first structured domain, evolving from the existing financial application.
- **Other domains:** Purchasing, Inventory, Production, Commercial, Logistics and Corporate Services are discovery candidates. They are not represented as implemented or committed capabilities.
- **Integration Layer:** controlled, versioned adapters and mappings between application domains and approved external/provider contracts.
- **Symbeon Financial Core:** independent provider-owned financial infrastructure. RSBUILD OS consumes only approved versioned interfaces; Core internals and methodology remain outside this repository.

## Current implementation status

This repository remains an evolving prototype/application foundation. Existing Finance capabilities and their limitations are documented in the Finance-domain implementation and MVP handoff documents. The RSBUILD OS product decision does not imply platform-wide completion, production readiness, tenant isolation, or live ERP/Core integration.

## Architecture and migration

- [RSBUILD OS Architecture & Repository Migration v1.0](docs/RSBUILD_OS_ARCHITECTURE_MIGRATION_v1.0.md)
- [Original Finance Architecture Baseline v1.0](docs/ARCHITECTURE_BASELINE_v1.0.md) — retained as the initial technical baseline; product scope is superseded by the migration document.
- [Finance-domain implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Finance-domain roadmap](docs/ROADMAP.md)
- [Application integration guidelines](docs/INTEGRATION_CONTRACT.md)
- [MVP readiness handoff](docs/MVP_READINESS_HANDOFF.md)
- [RSBUILD product brand assets](docs/BRAND_ASSETS.md)
- [Reusable brand kit and product export](docs/BRAND_KIT_EXPORT.md)

**Architecture status:** proposed and subject to review. Documentation does not authorize runtime, schema, infrastructure, Core-contract or production changes.

## Development

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

The application is available at http://localhost:3000.

## Validation

```bash
npm run typecheck
npm run build
```
