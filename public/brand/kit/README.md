# RSBUILD Brand Kit

This folder is the product-ready, code-facing layer of the RSBUILD identity system.

## Layers
- `../tokens.css` and `../tokens.json`: reusable design tokens.
- `../rsbuild-network-pattern.svg`: decorative background pattern.
- `../README.md`: asset inventory and usage rules.
- The exported production kit contains official primary/secondary logo lockups and individual icon exports. Add those files only from the verified export package; never recreate or approximate the official logo.

## Reuse in another product
1. Copy this brand-kit layer as the product's brand foundation.
2. Copy token files and only the assets the product actually uses.
3. Keep product-specific components and layouts outside this folder.
4. Record the source guide, kit version, variants, and exclusions.
5. Do not modify the source logo or silently change canonical tokens.

A product adapter may map these tokens into Tailwind, CSS Modules, or another theme system without changing canonical values.
