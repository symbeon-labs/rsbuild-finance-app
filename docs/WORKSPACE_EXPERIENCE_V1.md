# RSBUILD Workspace Experience v1.0

Status: Implementation-ready specification  
Target: `main`  
Branch: `feat/workspace-launcher-experience-v1`

## 1. Product decision

Introduce a minimal **Workspace Launcher** as the landing surface for operational tenant workspaces. It is a module-selection surface, not a dashboard.

The existing sidebar remains mounted and persistent after a module is opened. The Launcher complements the sidebar; it does not replace its module switcher or internal navigation.

### Navigation model

1. **Launcher (`workspace`)** — concise overview of the modules enabled for the current tenant and accessible to the current user.
2. **Persistent sidebar** — existing module switcher and section navigation, plus a clear way back to the Launcher.
3. **Module content** — existing dashboards and operational views remain unchanged.

Important distinction: `visao-geral` is already an existing operational section. Do not reuse it as the Launcher identifier.

## 2. Scope for this PR

### Included
- Operational tenant workspaces using `OperationalWorkspace`, initially Mundo do Sabor and Hub Açaí (including their configured QA tenants only if they are already supported by the current routing and preset logic).
- A minimal Launcher surface with one card per enabled and accessible top-level module.
- Return-to-launcher navigation in the existing sidebar.
- Existing module switching and internal section navigation remain functional.

### Explicitly excluded from this first implementation
- Institutional RSBUILD `ControlTowerWorkspace`. It has a separate information architecture and must not be changed implicitly.
- Rebuilding dashboards, module internals, organization selection or onboarding.
- New modules, new permissions, backend schema changes, Supabase/RLS changes, or new icon packages.
- Recent activity feeds, notification counters, command palette or other features not already backed by existing product capabilities.

If later product direction requires a unified Launcher for the institutional control tower, handle it in a separate scoped change after its information architecture is reviewed.

## 3. Existing architecture to preserve

The application resolves authentication, membership and organization in `app/page.tsx`. It renders `ControlTowerWorkspace` for the institutional RSBUILD organization and `OperationalWorkspace` for operational tenants.

The operational shell is `app/workspaces/operational-workspace.tsx` and already uses:
- `Sidebar` from `app/components/shell/sidebar.tsx`
- `Topbar` from `app/components/shell/topbar.tsx`
- `ORGANIZATION_PRESETS`, `EnabledModulesConfig`, `ModuleType` and `NavSection` from `app/types/workspace.ts`
- URL synchronization through the `tab` query parameter
- tenant context and server-side membership resolution

The sidebar already has:
- a module switcher based on `enabledModules`
- internal navigation filtered by module and contextual access props
- existing icon usage via `RsbuildIcon`

Implementation must extend these existing structures. Do not create a parallel module registry or duplicate the sidebar module-switching behavior.

## 4. Navigation contract

Add a distinct `workspace` value to `NavSection` and support it explicitly in the operational workspace URL parser and renderer.

Required behavior:
- When an operational tenant is opened without an explicit `tab`, show the Launcher.
- When a valid existing `tab` is present, preserve the requested destination. Existing deep links must not be redirected to the Launcher.
- `?tab=visao-geral` continues to open the existing overview/dashboard.
- Selecting a Launcher card opens the existing default section for that module, using the current module-to-section mapping. Do not create duplicate module pages.
- The sidebar receives a Launcher navigation item that calls the existing `onSelectSection` callback.
- Browser back/forward and URL state remain synchronized.
- Invalid or unauthorized tab values continue to fall back safely; do not weaken current access checks.

The Launcher is a navigation state inside the existing operational shell, not a new authentication flow, organization route or independent app shell.

## 5. Module visibility and access

Build Launcher cards from the same effective module configuration used by the current sidebar:
- `enabledModules` from the current organization preset / existing configuration.
- Existing contextual visibility conditions already applied by the sidebar.
- Existing server-resolved access props for restricted destinations where relevant.

Show one card per top-level enabled module, not one card per internal section. Do not list internal pages such as imports, reports, settlements or delivery proofs as separate Launcher cards.

The Launcher is a presentation layer, not an authorization boundary. Existing server/API authorization remains authoritative. Do not infer access from hidden cards alone.

Do not introduce a new entitlement or role matrix in this PR. If current module visibility is not consistently available to both Launcher and sidebar, extract a small shared pure helper from the existing rules and use it in both places; avoid duplicating conditional logic.

## 6. Minimal RSBUILD icon strategy

Reuse the existing icon library; do not introduce another icon package or create an icon for every feature.

- Component: `app/components/rsbuild-icons/index.tsx`
- Usage guide: `app/components/rsbuild-icons/README.md`
- Semantic color tokens: `app/globals.css` (`--rs-icon-primary`, `--rs-icon-secondary`, `--rs-icon-accent`, `--rs-icon-muted`)

The current source lists **16 original 24×24 monoline SVG icons**:
`control-tower`, `finance`, `reconciliation`, `logistics`, `guardian`, `audit`, `approval`, `document`, `import`, `matching`, `alert`, `analytics`, `users`, `integration`, `delivery`, `search`.

### Launcher icon mapping

Use only the icons that correspond to the four existing top-level operational modules:

| Module | Icon |
|---|---|
| Financeiro | `finance` |
| Reconciliação | `reconciliation` |
| Logística | `logistics` |
| Auditoria / Governança | `guardian` |

These icons already match the sidebar's `MODULE_CONFIGS`. Reuse that mapping or a shared typed module configuration; do not maintain a second mapping if avoidable.

No new icon glyphs are required for this PR. Internal destinations retain their existing icons in the sidebar.

## 7. Launcher UI

### Content
- Organization name and a concise label such as “Workspace”.
- One card per enabled top-level module.
- Each card contains the existing RSBUILD icon, module name and a short description.
- Cards open the existing module's default section.
- No recent activity, status badges, notification counts, search, keyboard shortcut or command palette in v1 unless an existing implementation can be reused without adding scope. Prefer omitting them for the first release.

### Visual direction
- Minimal, calm, precise and consistent with the current RSBUILD shell.
- Preserve existing `sand` and `dark` theme support.
- Use existing CSS variables and semantic icon tones.
- Subtle borders and restrained hover/focus states.
- Avoid excessive glow, gradients, badges, decorative LEDs and hard-coded icon colors.
- Keep card labels and descriptions concise.
- Responsive grid: desktop multi-column, tablet fewer columns, mobile single column or compact layout.
- Respect `prefers-reduced-motion`.
- Preserve visible keyboard focus and accessible button labels.

## 8. First-run tour

The operational workspace currently auto-opens `ProductTourModal` for users without the completion key. The tour must not obscure the Launcher on first arrival.

For this PR, delay the tour until after the user has entered a module, or provide a clear non-blocking trigger. Preserve the ability to launch the tour manually and its completion behavior. Do not remove the tour.

## 9. Implementation sequence

1. Add `workspace` as a distinct operational `NavSection`.
2. Make the Launcher the fallback initial section only when no explicit valid `tab` is supplied.
3. Implement a small Launcher component within the existing operational shell.
4. Derive cards from the same enabled-module configuration and semantic icon mapping used by the sidebar.
5. Add a Launcher entry to the existing sidebar navigation; keep the sidebar mounted and persistent.
6. Ensure card selection opens each module's existing default section.
7. Prevent the first-run tour from covering the Launcher.
8. Add tests for default entry, legacy deep links, module visibility, card navigation, sidebar return path and browser history.
9. Validate desktop/tablet/mobile in both themes; run typecheck, tests and production build; inspect preview.

## 10. Acceptance criteria

- [ ] Operational tenant without a `tab` lands on `tab=workspace` / Launcher.
- [ ] Existing valid deep links (including `visao-geral`) continue to work unchanged.
- [ ] Institutional RSBUILD Control Tower is unaffected.
- [ ] Exactly one card appears for each enabled top-level operational module.
- [ ] No disabled module or inaccessible destination is exposed.
- [ ] Cards use the existing four semantic module icons; no new glyphs or icon packages.
- [ ] Card selection opens the existing module and valid default section.
- [ ] Existing sidebar remains mounted and usable after module entry.
- [ ] Sidebar has a clear return-to-Launcher item.
- [ ] Existing sidebar module switcher and internal navigation continue to work.
- [ ] Browser back/forward and URL state remain coherent.
- [ ] First-run tour does not cover the Launcher and remains available.
- [ ] No changes to authentication, organization selection, Supabase, RLS or RBAC.
- [ ] Responsive layout, keyboard focus and reduced-motion behavior are verified.
- [ ] Typecheck, tests and production build pass; preview reviewed in both themes.

## 11. Non-goals

- Changing the institutional RSBUILD control tower.
- Replacing or redesigning the persistent sidebar.
- Creating a new module registry, permissions model or backend schema.
- Rebuilding dashboards or operational workflows.
- Adding speculative modules, icon glyphs, fake activity or notification indicators.
- Introducing search/command palette or other nonessential Launcher features in v1.
