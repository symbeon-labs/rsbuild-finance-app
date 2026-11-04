# RSBUILD Brand Kit

This directory documents the RSBUILD-specific, code-facing identity layer currently used by RSBUILD Finance.

It is not a neutral Symbeon design system, a universal UI foundation, or a default theme for other Symbeon products.

## Current layers

- `../tokens.css` and `../tokens.json`: canonical RSBUILD-specific visual tokens.
- `../rsbuild-network-pattern.svg`: decorative RSBUILD background pattern.
- `../README.md`: asset inventory, provenance, and usage boundaries.
- The verified RSBUILD production export contains official primary/secondary logo lockups and individual icon exports. Add those files only from that source package; never recreate or approximate the official logo.

## Permitted reuse

Reuse is limited to products and deliverables developed by Symbeon within the RSBUILD commercial relationship. Each use remains subject to the applicable contract, statement of work, RSBUILD brand approval, and usage permissions.

Do not copy or apply this identity layer by default to independent Symbeon products, including 3L0, ICIE, LASTRO, or other products outside the RSBUILD scope. Those products must select their own identity and theme.

## Future extraction

If a second in-scope RSBUILD product needs the same identity layer, the approved assets and tokens may be extracted into a separately versioned and configurable RSBUILD package.

That package, its distribution pipeline, and cross-product installation workflow are future work; they are not implemented by this repository today.

## Product adapter

A product-specific adapter may map approved RSBUILD tokens into Tailwind, CSS Modules, or another theme system without changing canonical values. Keep product-specific components, layouts, workflows, and behavior outside this brand-assets directory.

Record the source guide, package or kit version (when one exists), exact assets consumed, local overrides, provenance, and approval scope for each consuming product.

## Ownership and governance

Reusing RSBUILD brand assets does not automatically transfer ownership of repositories, product implementation, generic engineering tools, neutral design primitives, reusable adapters, or Symbeon methods. Ownership, licensing, permitted use, and maintenance obligations are governed by the signed contract and applicable statement of work.

Never modify the source logo or silently change canonical RSBUILD tokens.
