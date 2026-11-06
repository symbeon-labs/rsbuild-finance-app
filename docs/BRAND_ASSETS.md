# RSBUILD — Product Brand Assets

## Scope and source of truth
These assets implement the RSBUILD visual identity in RSBUILD Finance. The approved RSBUILD Visual Identity Guide supplied for this project remains authoritative for logo selection and visual usage. The production export must be copied only from its verified source package.

This is a product-specific brand layer. It is not a neutral Symbeon design system and does not authorize applying RSBUILD identity to unrelated Symbeon products.

## Identity tokens
| Token | Value | Intended use |
|---|---|---|
| Deep brown | #614943 | Institutional emphasis and selected highlight blocks |
| Warm beige | #D9CCB5 | Soft surfaces and breathing space |
| Charcoal | #2B2C2E | Primary text, contrast, dark surfaces |
| Terracotta | #B5583C | Signature accents, key icons, selected calls to action |
| Terracotta light | #C2694A | Subtle accent variation |

Canonical RSBUILD product tokens live in `public/brand/tokens.css` and `public/brand/tokens.json`.

## Typography
- Libre Franklin Bold / SemiBold: titles, headings, emphasis.
- Libre Franklin Regular: body copy, paragraphs, captions.
- For Office / Google Slides presentations, the guide specifies Arial.
- Font files are not embedded in the supplied PDF; use a properly licensed distribution.

## Graphic language
- Fine lines connecting nodes, with low opacity.
- Hexagonal geometry derived from the RSBUILD / RS Advogados family identity.
- Terracotta may highlight selected connection nodes.
- Patterns are background texture and must not compete with content.
- A restrained charcoal-to-terracotta gradient is appropriate for selected hero surfaces, covers, connection nodes, and UI dividers.
- Do not apply the gradient to the logo or use it as a recurring dominant background.

## Logo handling
Use the primary logo as the default. The secondary logo is reserved for materials at or above the guide's stated minimum size (300 × 150 px). Use the correct light/dark application from the guide.

Do not redraw, recolor, distort, crop, or recreate the official logo from a screenshot. Use the transparent/vector lockups from the verified RSBUILD production kit.

## Repository assets
- `public/brand/rsbuild-network-pattern.svg`: decorative pattern derived from the approved nodes-and-connections language. It is not a logo.
- `public/brand/rsbuild-logo-primary.svg`: scalable primary RSBUILD logo lockup reconstructed from the original vector paths on page 7 of the approved guide. The emblem and RSBUILD wordmark retain the guide's vector geometry; the descriptor is rendered as scalable text. The guide remains the visual source of truth.
- `public/brand/tokens.css` and `public/brand/tokens.json`: RSBUILD-specific product tokens.
- `public/brand/kit/README.md`: instructions for the RSBUILD identity layer.
- The supplied PDF includes the primary and secondary logo presentations and the icon library. The primary lockup used by the login screen is sourced from the page 7 vector artwork in the supplied PDF. The original editable design package and separate icon exports are still not present in this repository.

## Accessibility and product usage
- Maintain readable contrast for text and controls.
- Terracotta is an accent, not the only indicator of state.
- Decorative pattern must be hidden from assistive technology.
- Keep visual assets lightweight and avoid placing busy patterns behind dense financial tables.

## Reuse boundary
Reuse in another product is permitted only for products or deliverables developed by Symbeon within the RSBUILD commercial scope, subject to contract, statement of work, and brand approval. Other Symbeon products must use their own identity themes.

See [Identity Layer, Reuse, and Product Export](BRAND_KIT_EXPORT.md) for the governance and separation rules.
