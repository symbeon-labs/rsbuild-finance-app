# RSBUILD Workspace Experience v1.0

Status: Draft — implementation kickoff  
Target: `main`  
Branch: `feat/workspace-launcher-experience-v1`

## 1. Product decision

Introduce a Workspace Launcher as the initial landing surface after authentication and organization resolution. It is a module-discovery and navigation surface, **not a dashboard**.

The existing application shell and sidebar remain the persistent navigation system after a module is opened.

### Navigation model

1. **Launcher** — discover available modules, search and resume recent work.
2. **Persistent sidebar** — switch between enabled modules and global destinations without returning to the launcher.
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

## 3. Existing RSBUILD icon system — reuse, do not replace

The icon library already exists and is integrated in the sidebar and product tour:

- Component: `app/components/rsbuild-icons/index.tsx`
- Usage guide: `app/components/rsbuild-icons/README.md`
- Semantic color tokens: `app/globals.css` (`--rs-icon-primary`, `--rs-icon-secondary`, `--rs-icon-accent`, `--rs-icon-muted`)

The library contains 17 original 24×24 monoline SVG icons. Paths use `currentColor`; theme colors are token-driven.

### Current icon inventory

`control-tower`, `finance`, `reconciliation`, `logistics`, `guardian`, `audit`, `approval`, `document`, `import`, `matching`, `alert`, `analytics`, `users`, `integration`, `delivery`, `search`.

### Initial launcher mapping

Use the existing icon names where the semantic meaning is appropriate:

| Module / destination | Existing icon | Notes |
|---|---|---|
| Financeiro | `finance` | Direct semantic match |
| Reconciliação | `reconciliation` | Direct semantic match |
| Logística / Expedição | `logistics` or `delivery` | Choose based on module scope |
| Auditoria / Governança | `guardian` or `audit` | Governance vs. audit view |
| Projetos e Sprints | `document` | Suitable until a dedicated project glyph exists |
| Sandbox / Homologação | `approval` | Validation state; do not imply production approval |
| Agentes & IA / Integrações | `integration` | Existing integration glyph |
| Pessoas / Acessos | `users` | Direct semantic match |
| Indicadores / Analytics | `analytics` | Direct semantic match |
| Busca | `search` | Existing search glyph |

### Icon gaps to evaluate during implementation

The current icon set does not have dedicated glyphs for production, inventory, purchasing, stores/branches, e-commerce, maintenance, marketing or HR administration. Do not use emoji or silently map unrelated icons. Extend `RsbuildIconName` and `ICON_PATHS` with original monoline SVG paths in the same 24×24 grid, rounded stroke treatment, no embedded colors and semantic `currentColor` tokens. Document each addition in the existing README. Add only glyphs required by modules that actually exist in the current product configuration.

## 4. Launcher experience

### Header
- Organization name and concise workspace context.
- Search field for modules and destinations.
- Optional keyboard shortcut hint only if the shortcut is actually implemented.
- Do not add a second global command system if an existing one is discovered.

### Module cards
Each card contains:
- RSBUILD icon from `RsbuildIcon`
- concise module name
- one-line description
- optional small status/attention indicator only when backed by real state
- clear interactive and focus-visible states

Cards are generated from the existing organization preset / enabled-module configuration and permission-resolved navigation data. They must not expose unavailable modules or imply capabilities that are not enabled.

### Supporting elements
- Recent destinations only if reliable recent-navigation state is available; otherwise defer.
- Notifications only when backed by an existing notification source; do not invent counts.
- Search results must obey the same authorization filtering as the cards and sidebar.

## 5. Visual direction

- Preserve RSBUILD brand identity and the existing `sand` / `dark` theme support.
- Dark workspace direction: deep graphite/navy surfaces with restrained violet/cyan accents, not a separate unthemed palette.
- Reuse current CSS variables and semantic icon tones; avoid hard-coded per-icon colors.
- Cards: subtle border, restrained surface elevation, quiet hover/focus feedback and short transitions.
- Avoid excessive glow, gradients, badges or decorative status LEDs.
- Typography and spacing must remain consistent with the current shell.
- Responsive: desktop grid; tablet and mobile progressively reduce columns; sidebar may use its existing responsive/collapsed behavior and must remain reachable after module entry.
- Respect `prefers-reduced-motion`.

## 6. Interaction and routing

- Launcher is the default entry surface after organization resolution for the new experience.
- A card opens the corresponding existing module and its valid default section.
- Add a launcher destination to the existing navigation model so users can return to it from the persistent sidebar.
- Preserve existing deep links and `?organizationId=...` / `?tab=...` behavior.
- Browser back/forward must keep URL and selected content coherent.
- Do not change organization selection, authentication, membership checks, RBAC, or tenant isolation as part of this UI change.
- Do not treat a hidden card as an authorization boundary; server/API checks remain authoritative.
- Existing first-run product tour must not automatically obscure the launcher. Keep the guide available through its existing explicit entry point or define a non-blocking, deliberate trigger.

## 7. Implementation sequence

1. Add a typed launcher destination to the existing navigation model and route synchronization.
2. Build a focused launcher component using existing presets, enabled modules, permission-filtered destinations and `RsbuildIcon`.
3. Integrate it into the existing workspace shell without removing or replacing the sidebar.
4. Add only the icon glyphs needed by enabled modules in scope; update the icon README.
5. Add component/logic tests for module visibility, routing, search filtering and keyboard/focus behavior.
6. Validate desktop, tablet and mobile in both `sand` and `dark` themes.
7. Run typecheck, test and production build; inspect the Vercel preview before merge.

## 8. Acceptance criteria

- [ ] Authenticated user lands on the launcher after the organization is resolved.
- [ ] Only modules enabled for the organization and available to the user are shown.
- [ ] Cards use the existing RSBUILD geometric icon system; no emoji substitutes.
- [ ] Missing icon glyphs are added consistently and documented, only where needed.
- [ ] Selecting a card opens the existing module, not a duplicate implementation.
- [ ] Sidebar remains visible/reachable and supports module switching after entry.
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
- Rebranding the application independently of the existing RSBUILD design system.

## 10. Known implementation risks

- The current organization presets are the authoritative starting point for enabled modules, but some sidebar destinations are conditional on additional server-resolved permissions. Launcher visibility must use the same effective conditions.
- The current app has both control-tower and operational workspace shells. Confirm whether the launcher should be shared by both before broadening integration; do not silently change the institutional RSBUILD workspace.
- The current tour auto-opens on first use in the operational shell and can conflict with a new landing experience.
- Icon names in the existing library are a deliberately small semantic vocabulary. Extend it instead of introducing a competing icon package.
