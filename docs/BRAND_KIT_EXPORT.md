# RSBUILD — Reusable Brand Kit and Product Export

## Decision
Treat the RSBUILD identity as a portable brand kit, not as styling embedded in a single product. Each product consumes a versioned copy of canonical brand assets and maps them to its own UI system.

## Separation of concerns
- **Brand core:** approved logo lockups, icon library, graphic patterns, palette, typography, and usage rules.
- **Product adapter:** CSS variables, Tailwind/theme mappings, component-level choices, and product-specific compositions.
- **Product UI:** screens, workflows, data visualizations, and interactions. These remain owned by the product.

## Current Finance integration
- Canonical color and typography tokens: `public/brand/tokens.css` and `public/brand/tokens.json`.
- Decorative network pattern: `public/brand/rsbuild-network-pattern.svg`.
- Usage and provenance: `docs/BRAND_ASSETS.md` and `public/brand/README.md`.

The separately exported production kit contains transparent primary/secondary logo lockups and individual icon exports. Those binary assets are not duplicated in this commit because the available repository write path accepts UTF-8 content only. They remain in the delivered kit; do not substitute screenshots or redraw the official logo.

## Export protocol for future products
1. Select the approved kit version and source guide.
2. Copy only required brand-core assets into the target product.
3. Add a small adapter for the product's styling system.
4. Preserve filenames, source notes, and provenance.
5. Validate logo contrast/minimum size, typography availability, token use, and decorative asset accessibility.
6. Record the kit version and local overrides in the product repository.

## Versioning
- **Patch:** metadata, documentation, or non-visual corrections.
- **Minor:** additive assets or tokens that do not change existing meaning.
- **Major:** changes to approved logo variants, core palette, typography, or usage rules.

## Guardrails
- Never recolor, distort, crop, or apply gradients to the official logo.
- Do not place decorative patterns behind dense financial tables or reduce text contrast.
- Product adapters may alias tokens but must not redefine canonical values without an explicit brand decision.
