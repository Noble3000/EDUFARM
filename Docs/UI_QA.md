# EDUFARM — Visual QA Checklist (UI Consistency Pass)

> Source of truth: `design.html` v2 + `packages/tokens/tokens.json`.
> One language: `packages/ui/src/styles.ts` (`EDU_CSS`) + `packages/ui/src/components.tsx`.
> shells: `apps/*/app/layout.tsx` import `EDU_CSS`; tone differs by color only
> (`tone-student` youthful gradient · `tone-lecturer` solid green · `tone-admin` dark slate).
> No screen may invent its own radius, shadow, button, input, badge, or alert style.
> Product hierarchy and business rules unchanged (API untouched — see git scope).

## 0. Global gates (every screen, every app)

- [ ] Typography: Sora headings / Inter body, base 16px / 1.6, text left-aligned, one 1080px rail.
- [ ] Contrast: body `--ink #101828`, secondary `--muted #344054` (7:1 on white). No `#667085` text.
- [ ] Targets: every button / link / tab / pager / checkbox row ≥ 44px (icon-only ≥ 44×44).
- [ ] Labels: every input/select/textarea inside shared `<Field>` (real `<label htmlFor>`); checkboxes use `label.checkrow`.
- [ ] Focus: Tab through the screen — gold `--accent` ring visible on every stop; skip-link present (`Skip to content`).
- [ ] Keyboard: tabs arrow-navigate, modal Esc-closes, no div-buttons, logical tab order.
- [ ] Icons: shared `Icon` SVG set only. Zero emoji in UI (audit: node emoji scan = 0 hits).
- [ ] States present: loading → `LoadingState`/skeleton; empty → `EmptyState`; error → `Alert kind="error"`/`ErrorState`; success → `SuccessNote`.
- [ ] Disabled: `disabled` buttons at 55% + `not-allowed`; disabled inputs greyed.
- [ ] Reduced motion: shimmer/transition off under `prefers-reduced-motion`.
- [ ] Mobile 360px: single column, no horizontal scroll except `.tbl-wrap` tables; bottom nav reachable.

## 1. Component inventory (what "standard" means)

| Element | Standard | Where defined |
| :--- | :--- | :--- |
| Type scale | 12 / 13 / 14 / 16 / 20 / 24 / 30, Sora display | `EDU_CSS`, tokens |
| Spacing | 4-base (4,8,12,16,20,24,32,40); card pad 20/16; section gap 14 | `EDU_CSS` |
| Radius | 12 controls · 16–18 cards · 20 hero/modal · 999 pills/badges | `EDU_CSS` |
| Borders | 1px `--line #E5E7EB`; inputs `--line-strong #D0D5DD`; focus 2px brand | `EDU_CSS` |
| Shadows | card `0 1px 2px`; pop/modal `0 8px 28px` | `EDU_CSS` |
| Buttons | primary/accent/outline/danger/ghost, 12×20 pad, 700, 44px, gold ring | `EDU_CSS` |
| Inputs | 44px, 11–12px pad, label + hint + err/success slots, `aria-invalid` on error | `Field` + `EDU_CSS` |
| Tabs | `role=tablist/tab`, `aria-selected`, arrow-key nav | `Tabs` |
| Badges | official/verified/urgent/edition/points + ok/info/warn/bad, icon+text baseline | `Badge` + `EDU_CSS` |
| Alerts | info/success/warn/error, icon, `role=status`/`alert` | `Alert` |
| Modal/drawer | `role=dialog aria-modal`, labelled, Esc + overlay close, 44px close | `Modal`, `Confirm` |
| Tables | `.tbl-wrap` scroll + `table.tbl`, `th scope=col`, row hover | `DataTable` |
| Pagination | 44px prev/numbers/next, `aria-current="page"` | `Pagination` |
| Empty | icon + title + body + action | `EmptyState` |
| Skeleton | `.skel` shimmer rows + `role=status` label | `LoadingState` |
| Error | icon + message + retry button | `ErrorState` |
| Success | green note, `role=status` | `SuccessNote` |

## 2. Screen-by-screen (pass 2026-10-04)

Student (`:3001`) — youthful tone allowed (gradient hero, pink accents), same geometry:

- [ ] `/` home — hero-youth greeting + counts; Word/reflection/priorities/continue/courses/updates/Q&A left rail; pulse/points/AI/library/trust right rail.
- [ ] `/login` — `Field`(Email/Password/API-URL optional+hint); Loading/Success/Alert states; demo + logout intact.
- [ ] `/signup` — `Field` ×5 + hints/autocomplete; Loading/Success/Alert states.
- [ ] `/verify` — `Field` labels; status `Badge`; Loading/Success/Alert states.
- [ ] `/courses` — `LoadingState` vs `EmptyState`(Verify action) split.
- [ ] `/courses/[id]` — `LoadingState`; `EmptyState` per section; Q&A + AI inputs in `Field`; AI busy/error states.
- [ ] `/materials/[id]` — `ErrorState`+retry; points/rating/review in `Field`; reviews `EmptyState`.
- [ ] `/library` — `LoadingState`; `EmptyState` for purchased + free lists.
- [ ] `/grades` — labelled semester form; `DataTable` (Code/Units/Grade) + `EmptyState`; CGPA hero unchanged in meaning.
- [ ] `/assessments/[id]` — radios as `checkrow`; theory in `Field`; start/result/success/error states.

Lecturer (`:3002`) — professional tone (`.hero-pro`, no pink/gradient), same geometry:

- [ ] `/` dashboard — `.hero-pro` header; `Manage →` is SVG `Icon arrowR` 44px.
- [ ] `/login`, `/signup` — `Field` labels; Loading/Success/Alert states; same endpoints/bodies.
- [ ] `/courses/[id]` manage — enrollments `DataTable`; announcement composer labelled; upload form labelled (`checkrow` Free); assessments builder labelled; insights callouts as `Alert info/warn` + bulb list; `EmptyState` actions route to composer.

Admin (`:3003`) — sober governance tone, same geometry:

- [ ] `/` home — icon+label link list, same hrefs, sober tone.
- [ ] `/login`, `/signup` — `Field` labels; Loading/Success/Alert states.
- [ ] `/verifications` — `DataTable` + status `Badge` + `Pagination(10)` + Loading/Error/Empty(`Queue clear`); approve/reject identical.
- [ ] `/reviews` — `DataTable` + `Badge` + `Pagination(10)` + states; publish/reject identical.
- [ ] `/settlements` — overview `DataTable`; run/pay behind `Confirm` (same calls on confirm).
- [ ] `/disputes` — `prompt()` replaced by accessible `Modal`+`Field` note (same resolve call); `DataTable` + `Badge` + `Pagination(10)`.
- [ ] `/email` — outbox `DataTable` + `Badge` + `Pagination(10)` + states.
- [ ] `/onboarding` — `Field` labels (name/slug+hint/email); pending `DataTable` + `Pagination(10)` + states.

## 3. Verify commands (local-first, no deploy)

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @edufarm/web-student typecheck
& "$env:APPDATA\npm\pnpm.cmd" --filter @edufarm/web-lecturer typecheck
& "$env:APPDATA\npm\pnpm.cmd" --filter @edufarm/web-admin typecheck
node C:\Users\HomePC\AppData\Local\Temp\opencode\ui-audit.js  # bare labels / #667085 / raw msg
# emoji: 0 hits across apps + packages/ui + index.html + design.html (2026-10-04)
# builds: student + lecturer + admin green (2026-10-04)
# live: :3001 / :3002 / :3003 / :4000/health HTTP 200 after pm2 resurrect
```

## 4. Rules for future screens

1. Import from `@edufarm/ui` first; no local button/input/badge/alert CSS.
2. New pages need: labelled fields, loading/empty/error/success states, 44px targets, keyboard path, focus ring check.
3. Youthful energy = copy + student pink/gradient accents; never new shapes. Lecturer/admin stay restrained.
4. No emoji in UI — extend `Icon` in `packages/ui/src/icons.tsx` instead.
5. Log every visual change in `Docs/PRD.md` before commit (owner rule).
