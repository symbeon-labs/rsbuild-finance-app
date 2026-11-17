# RSBUILD Workspace Experience v1.0

Status: Draft — implementation kickoff  
Target: `main`  
Branch: `feat/workspace-launcher-experience-v1`

## 1. Product decision

Introduce a Workspace Launcher as the initial landing surface after authentication and organization resolution. It is a module-discovery and navigation surface, **not a dashboard**.

The existing application shell and sidebar remain the persistent navigation system after a module is opened.

### Navigation model

1. **Launcher** — discover available modules and search destinations.
2. **Persistent sidebar** — switch between enabled modules and return to the launcher.
3. **Module content** — existing dashboards, views and operational workflows remain the source of truth.

The launcher must not replace or duplicate the sidebar's navigation responsibilities.

## 2. Existing architecture to preserve

The current application resolves the authenticated user and organization in `app/page.tsx`, then renders either `ControlTowerWorkspace` or `OperationalWorkspace`.

The operational shell is composed in `app/enterprise-workspace.tsx` and already uses:
- `Sidebar` from `app/components/shell/sidebar.tsx`
- `Topbar` from `app/components/shell/topbar.tsx`
- organization presets and enabled-module configuration from `app/types/workspace.ts`
- URL synchronization through the `tab` query parameter
- tenant-specific access checks and server-resolved sandbox permissions

Implementation must reuse these structures. Do not create a second navigation registry or bypass server-side authorization.

## 3. RSBUILD icon system — minimal and precise

Reuse the existing icon library; do not introduce another icon package or create an icon for every feature.

- Component: `app/components/rsbuild-icons/index.tsx`
- Usage guide: `app/components/rsbuild-icons/README.md`
- Semantic color tokens: `app/globals.css` (`--rs-icon-primary`, `--rs-icon-secondary`, `--rs-icon-accent`, `--rs-icon-muted`)

The current source lists **16 original 24×24 monoline SVG icons**. Paths use `currentColor`; theme colors are token-driven.

Inventory: `control-tower`, `finance`, `reconciliation`, `logistics`, `guardian`, `audit`, `approval`, `document`, `import`, `matching`, `alert`, `analytics`, `users`, `integration`, `delivery`, `search`.

### Rules

1. One icon per top-level module card; secondary functions do not get their own card icon.
2. Reuse an existing icon only when its meaning is accurate.
3. Create a new glyph only when a real, enabled top-level module has no suitable existing icon.
4. Do not add icons speculatively for hypothetical modules.
5. No emoji, decorative icon clutter, or mixed icon libraries.
6. Preserve the existing 24×24 grid, monoline stroke, `currentColor` and semantic theme tokens for any justified addition.

### Initial semantic mapping

| Module / destination | Existing icon | Guidance |
|---|---|---|
| Financeiro | `finance` | Direct match |
| Reconciliação | `reconciliation` | Direct match |
| Logística / Expedição | `logistics` | Prefer one glyph for the parent module |
| Governança / Auditoria | `guardian` or `audit` | Choose one based on the actual module identity |
| Projetos / Documentos | `document` | Reuse only if this is a real top-level module |
| Homologação | `approval` | Use only if exposed as a top-level destination |
| Integrações | `integration` | Direct match |
| Pessoas / Acessos | `users` | Direct match |
| Indicadores | `analytics` | Direct match |

This is a semantic guide, not a requirement to display every item. The launcher must reflect only the modules already enabled and authorized in the current product configuration. If a module lacks an accurate icon, use a restrained text-first card temporarily rather than a misleading glyph. Review actual enabled modules before adding any new icon.

## 4. Launcher experience

### Header
- Organization name and concise workspace context.
- Search field for modules and destinations.
- Do not add a second global command system if an existing one is discovered.
- Do not display a keyboard shortcut hint unless the shortcut is implemented.

### Module cards
Each card contains:
- One RSBUILD icon where an accurate existing glyph is available.
- Concise module name.
- One-line description.
- Optional status indicator only when backed by real state.
- Clear interactive and focus-visible states.

Cards are generated from existing organization presets / enabled-module configuration and permission-resolved navigation data. They must not expose unavailable modules or imply capabilities that are not enabled.

### Supporting elements
- Keep the first version focused: no recent activity feed or notification counters unless reliable existing data sources already support them.
- Search results obey the same authorization filtering as cards and sidebar.

## 5. Visual direction

- Preserve RSBUILD brand identity and existing `sand` / `dark` theme support.
- Dark workspace direction: deep graphite/navy surfaces with restrained violet/cyan accents.
- Reuse current CSS variables and semantic icon tones; avoid hard-coded per-icon colors.
- Cards: subtle border, restrained surface elevation, quiet hover/focus feedback and short transitions.
- Avoid excessive glow, gradients, badges, decorative status LEDs and unnecessary visual elements.
- Typography and spacing remain consistent with the current shell.
- Responsive: desktop grid; tablet and mobile progressively reduce columns; existing sidebar responsive behavior remains available after module entry.
- Respect `prefers-reduced-motion`.

## 6. Interaction and routing

- Launcher is the default entry surface after organization resolution for the new experience.
- A card opens the corresponding existing module and its valid default section.
- Add a launcher destination to the existing navigation model so users can return to it from the persistent sidebar.
- Preserve existing deep links and `?organizationId=...` / `?tab=...` behavior.
- Browser back/forward must keep URL and selected content coherent.
- Do not change organization selection, authentication, membership checks, RBAC, or tenant isolation.
- Do not treat a hidden card as an authorization boundary; server/API checks remain authoritative.
- Existing first-run product tour must not automatically obscure the launcher.

## 7. Implementation sequence

1. Add a typed launcher destination to the existing navigation model and route synchronization.
2. Build a focused launcher component using existing presets, enabled modules, permission-filtered destinations and `RsbuildIcon`.
3. Integrate it into the existing workspace shell without removing or replacing the sidebar.
4. Use the existing icon vocabulary; add a glyph only if implementation reveals a genuine top-level module gap.
5. Add tests for module visibility, routing, search filtering and keyboard/focus behavior.
6. Validate desktop, tablet and mobile in both `sand` and `dark` themes.
7. Run typecheck, tests and production build; inspect the Vercel preview before merge.

## 8. Acceptance criteria

- [ ] Authenticated user lands on the launcher after organization resolution.
- [ ] Only modules enabled for the organization and available to the user are shown.
- [ ] Cards use a small, semantically accurate subset of the RSBUILD icon system.
- [ ] No emoji substitutes, duplicate icon packages or speculative icon additions.
- [ ] Selecting a card opens the existing module, not a duplicate implementation.
- [ ] Sidebar remains available and supports module switching after entry.
- [ ] Launcher can be reopened from the sidebar.
- [ ] Existing deep links, organization context and permission checks continue to work.
- [ ] Search does not reveal inaccessible modules or sections.
- [ ] No fabricated recent activity, notification counts or maturity claims.
- [ ] Responsive behavior and reduced-motion preferences are respected.
- [ ] Typecheck, tests and build pass; visual preview reviewed in both themes.

## 9. Explicit non-goals

- Rebuilding dashboards or operational module internals.
- Changing Supabase schema, RLS, authentication, memberships or RBAC.
- Replacing the existing sidebar or creating a parallel navigation framework.
- Adding artificial metrics, fake notifications or unsupported module claims.
- Creating a dedicated icon for every feature or hypothetical module.
- Rebranding the application independently of the existing RSBUILD design system.

## 10. Known implementation risks

- Organization presets are the starting point for enabled modules, but some sidebar destinations are conditional on additional server-resolved permissions. Launcher visibility must use the same effective conditions.
- The app has both control-tower and operational workspace shells. Confirm the intended scope before broadening integration; do not silently change the institutional RSBUILD workspace.
- The current tour can conflict with a new landing experience; it must not automatically obscure the launcher.
- Keep the implementation focused on the actual enabled modules, not a speculative future catalog.
