# RSBUILD — Product Brand Assets

## Source of truth
The approved source is the RSBUILD Visual Identity Guide supplied for this project. The guide remains authoritative for logo selection and visual usage. The portable production export is maintained separately and must be copied from its verified package when binary assets are installed.

## Identity tokens
| Token | Value | Intended use |
|---|---|---|
| Deep brown | #614943 | Institutional emphasis and selected highlight blocks |
| Warm beige | #D9CCB5 | Soft surfaces and breathing space |
| Charcoal | #2B2C2E | Primary text, contrast, dark surfaces |
| Terracotta | #B5583C | Signature accents, key icons, selected calls to action |
| Terracotta light | #C2694A | Subtle accent variation |

Canonical code tokens live in `public/brand/tokens.css` and `public/brand/tokens.json`.

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
- `public/brand/tokens.css` and `public/brand/tokens.json`: canonical product-facing tokens.
- `public/brand/kit/README.md`: instructions for consuming and exporting the kit.
- The full export package contains the official logo variants and individual icon exports; these binary assets are not yet copied into this repository.

## Accessibility and product usage
- Maintain readable contrast for text and controls.
- Terracotta is an accent, not the only indicator of state.
- Decorative pattern must be hidden from assistive technology.
- Keep visual assets lightweight and avoid placing busy patterns behind dense financial tables.

See [Reusable Brand Kit and Product Export](BRAND_KIT_EXPORT.md) for the cross-product reuse protocol.
