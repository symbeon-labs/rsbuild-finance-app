# RSBUILD — Identity Layer, Reuse, and Product Export

## Decision
The RSBUILD visual identity is a brand-specific layer. It is implemented first in RSBUILD Finance and may later be extracted into an independently versioned and configurable package for products and deliverables developed by Symbeon for the RSBUILD ecosystem.

This repository does not establish a universal Symbeon design system. It documents the RSBUILD identity and its product-level implementation only.

## Separation of concerns
- **RSBUILD identity source:** the approved RSBUILD visual identity guide, official logo lockups, iconography, graphic patterns, palette, typography, and usage rules. RSBUILD remains the authority for its brand assets and approvals.
- **RSBUILD identity package (future extraction):** a separately versioned package containing only the approved RSBUILD assets, tokens, provenance, and usage rules. Extraction is a future step, triggered when a second in-scope RSBUILD product needs to consume it; this package and its distribution pipeline are not claimed to exist today.
- **Product adapter:** product-specific mapping of approved RSBUILD tokens and assets into CSS variables, Tailwind/theme configuration, components, and layouts.
- **Product UI:** screens, workflows, data visualizations, and interactions. These remain governed by the applicable product agreement and statement of work.

## Current Finance integration
- RSBUILD color and typography tokens: `public/brand/tokens.css` and `public/brand/tokens.json`.
- RSBUILD decorative network pattern: `public/brand/rsbuild-network-pattern.svg`.
- Usage and provenance: `docs/BRAND_ASSETS.md` and `public/brand/README.md`.

The separately exported production kit contains transparent primary/secondary logo lockups and individual icon exports. Those binary assets are not duplicated in this commit. Do not substitute screenshots or redraw the official logo.

## Reuse scope
Reuse is limited to products and deliverables developed by Symbeon within the RSBUILD commercial relationship, and remains subject to the applicable contract, statement of work, brand approval, and usage permissions.

The RSBUILD identity must not be applied by default to Symbeon-owned products outside that scope, including 3L0, ICIE, LASTRO, or other independent Symbeon initiatives. Those products retain their own product identities.

## Neutral design core and 4TL4S
A neutral, brand-independent design core may be developed separately within Symbeon / 4TL4S. Its purpose is to provide reusable primitives and contracts for semantic tokens, component behavior, accessibility, and product theme adapters.

That neutral core is not contained in this repository, is not derived from RSBUILD's brand identity, and must not inherit RSBUILD colors, typography, logo, patterns, or brand-specific rules as defaults. Each product selects and owns its own theme through an explicit adapter.

## Product configuration contract
Any future RSBUILD product consuming an extracted identity package should record:
1. package version and source guide;
2. exact assets and tokens consumed;
3. product adapter and approved local overrides;
4. provenance and usage restrictions;
5. product owner and approval scope.

## Ownership and governance
Reusing approved RSBUILD brand assets does not automatically transfer ownership of repositories, product implementation, generic engineering tools, neutral design primitives, reusable adapters, or Symbeon methods.

Ownership, licenses, permitted use, maintenance obligations, and deliverable rights are governed by the signed contract and applicable statement of work. Nothing in this document grants rights beyond those agreements. RSBUILD's brand assets remain subject to RSBUILD's source materials and approvals.

## Versioning
For a future extracted RSBUILD identity package:
- **Patch:** metadata, documentation, or non-visual corrections.
- **Minor:** additive approved assets or tokens that do not change existing meaning.
- **Major:** changes to approved logo variants, core palette, typography, or usage rules.

## Guardrails
- Never recolor, distort, crop, or apply gradients to the official logo.
- Do not place decorative patterns behind dense financial tables or reduce text contrast.
- Product adapters may map approved tokens but must not redefine canonical RSBUILD values without explicit brand approval.
- Do not copy RSBUILD identity assets into unrelated Symbeon products.
- Do not describe the future package, extraction workflow, or distribution pipeline as already implemented.
