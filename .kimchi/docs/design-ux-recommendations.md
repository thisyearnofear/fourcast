# Fourcast UI/UX Recommendations
## Progressive Disclosure + Canvas UI Integration

### Summary

The product already has a strong editorial/minimal design system (`tokens.css`, `design.md`) and a genuinely differentiated proof-chain story. The current risk is not visual poverty — it is **cognitive overload**. Several surfaces present every detail at once, which makes the interface feel flat and dense rather than calm and precise. The feedback is correct on both counts: we should disclose progressively by audience and intent, and we should use motion/canvas selectively to explain the primitives rather than decorate around them.

**canvas-ui** is a good fit because:
- It renders WebGL effects over **real HTML**, so accessibility, SEO, and interaction remain intact.
- It is framework-agnostic with React builds, matching the Next.js 16 + React 19 stack.
- Components are copied into source (shadcn-style), so there is no runtime dependency drift.
- Effects degrade gracefully where `html-in-canvas` is unavailable (Chrome/Edge 140+ with flag).

The recommended posture: use canvas-ui as an **explanatory layer**, not a wallpaper layer. Every effect should answer a user question; if it does not, it is visual noise.

---

### Status (as of 2026-07-24)

**Shipped:**

- Audience-mode switch (analyst / operator / allocator) with localStorage persistence and route-derived defaults. `hooks/useAudience.js`, `app/components/AudienceSwitcher.js`, surfaced in chrome.
- Mode-aware section ordering in SearchLanding, `/agent`, `/positions`, DecisionDossier, ProofTheatre. Each surface answers its audience's primary question first.
- ReasoningVisualizer rewrote: 7 phases → 3 (Discover → Forecast → Verify), `useReducedMotion` respect, palette fixed to `--color-accent` / `--color-evidence` / `--color-sealed`.
- ProofTheatre accordion disclosure with lead stage open by default and spine-fill animation that grows from the top to the highest-opened stage.
- DecisionDossier accordion: each of the five blocks collapses; lead block opens by default per audience; visual lead highlight updates on mode switch.
- chrome quiet-down: 6 primary + 2 secondary + tour → 4 primary + More overflow, single-icon audience switcher + popover, active route uses `aria-current="page"` with 2px emerald inset underline.
- Tailwind v3 → v4 migration (full, CSS-first `@theme inline`).
- canvas-ui **Ripple** on three receipt-seal CTAs (Open Proof Theatre, Inspect decision dossier, Open full verification).
- canvas-ui **Glass** lens on the dossier "What did the agent know?" block.
- canvas-ui **Liquid** backdrop on ReasoningVisualizer (low intensity emerald tint).
- canvas-ui **Particle Reveal** on the landing decision instrument.
- canvas-ui **Magnify** on the MarketEdgeScanner odds comparison.
- Motion budget utility (`hooks/useMotionBudget.js`): module-scoped registry with priority + max + visible flags, 6 unit tests.

**Outstanding:**

- Agent Dashboard step/recommendation truncation (collapsed-by-default state).
- Landing audience-door / receipt deferral (defer audience doors and verified-receipt section to scroll or first interaction).
- Mandate Control policy/telemetry disclosure ("Inspect policy" / "Raw telemetry" expanders).
- Motion budget is opt-in: the canvas-ui surfaces in this repo are not yet wrapped in `useMotionBudget`. Wire the hook into the canvas-ui wrappers next so the policy is enforced by default.

---

### 1. Progressive Disclosure Audit

#### 1.1 Landing page (`SearchLanding.js`)
**Current state:** Hero, decision instrument, two audience doors, verified receipt proof theatre teaser, and operator math all render immediately.
**Problem:** A cold visitor is asked to absorb operator-terminal grammar, audience doors, and an on-chain proof example in one scroll.
**Recommendation:**
- **Default view:** Search box + decision instrument only. This is the one-sentence value prop.
- **On first interaction** (typing a query or hovering the instrument), gently reveal the audience doors.
- **Scroll below the fold** reveals the verified receipt section.
- Keep the decision instrument’s six data points (market / AI fair / edge / direction / confidence) but reveal the on-chain provenance line only on hover/focus.

#### 1.2 Mandate Control (`MandateControl.js`)
**Current state:** Renders decision headline, verdict, policy posture, proof timeline, actions, and telemetry strip simultaneously.
**Problem:** The proof timeline is the differentiated element, but it competes with policy numbers and telemetry for attention.
**Recommendation:**
- **Primary state:** Headline + verdict + one-line rationale + proof timeline only.
- **Secondary state ("Inspect policy"):** Expand into the policy numbers (max allocation, min edge, tail).
- **Tertiary state ("Raw telemetry"):** Expand the worker host / hash / on-chain verdict strip.
- The timeline should animate the crossing from "outcome withheld" to "proof available" on mount; that is the signature motion and it is currently static until data updates.

#### 1.3 Decision Dossier (`DecisionDossier.js`)
**Current state:** Right-side drawer dumps all five dossier blocks plus raw JSON toggle.
**Problem:** It is well-structured, but an allocator likely only wants the verdict + integrity check first; everything else is diligence depth.
**Recommendation:**
- **Layer 1:** Verdict, headline, and "receipt intact" badge.
- **Layer 2:** Expand each of the five numbered blocks independently (accordion) instead of showing them all.
- **Layer 3:** "View raw receipt" remains a tertiary toggle.
- The "What did the agent know?" block is the natural place for a canvas-ui **Magnify** or **Glass** lens to let a user inspect odds movement.

#### 1.4 Agent Dashboard (`AgentDashboard.js`)
**Current state:** Controls, run button, live progress, recommendations, arbitrage, builder dashboard all stacked.
**Problem:** The panel grows vertically and reveals every stage regardless of relevance.
**Recommendation:**
- Start collapsed: category selector + Run button.
- During run: show only the current step and the progress bar, with a "Show all steps" expander.
- After run: show top 3 recommendations with a "Show N more" expander; hide arbitrage and builder unless relevant.
- Builder dashboard already has a `compact` variant — use it as a footer, not a section.

#### 1.5 Proof Theatre (`ProofTheatre.js`)
**Current state:** Six-stage vertical timeline with all details open.
**Problem:** This is the most important teaching surface, but it is all shown at once.
**Recommendation:**
- Start with the six stage nodes collapsed to a single-line timeline.
- Click/hover a stage to reveal its evidence block.
- Animate the spine fill as stages complete; use the existing `mc-proof-flash` at reconciliation.
- Stage 5 (TxLINE Merkle proof + Solana) is a good candidate for a **Particle Reveal** or **Ripple** effect: as the user hovers, particles resolve into the verification checks.

#### 1.6 Reasoning Visualizer (`ReasoningVisualizer.js`)
**Current state:** Full-screen overlay lists every reasoning step.
**Problem:** It is mostly decorative and not tied to real backend steps; the emoji + purple gradient feels disconnected from the emerald evidence language.
**Recommendation:**
- Keep the overlay, but reduce it to **three phases** (Discover → Forecast → Verify) with real backend progress, not seven synthetic steps.
- Replace the purple gradient with the emerald/sealed/evidence semantic colors from `tokens.css`.
- Use a subtle **Liquid** or **Ripple** backdrop behind the modal instead of the gradient to signal "computation in progress" without stealing focus.

---

### 2. canvas-ui Integration Plan

#### 2.1 Fit assessment

| canvas-ui component | Where it fits | Risk | Recommendation |
|---|---|---|---|
| **Liquid** | Reasoning overlay background, agent "thinking" state | High motion, can feel game-like | Use low viscosity + monochrome emerald tint; keep opacity low |
| **Ripple** | Proof Theatre verification stage, receipt seals | Tasteful, tied to user click/hover | Strong fit for "seal" interactions |
| **Particle Reveal** | Hero decision instrument reveal, proof stage completion | Eye-catching, needs restraint | Use once per session on the instrument |
| **Glass** | Mandate Control / Dossier hover lens over dense metrics | Useful for inspection | Strong fit for "inspect evidence" |
| **Magnify** | Odds comparison in MarketEdgeScanner / Proof Theatre | Directly explains edge | Strong fit |
| **Grid / Hex Float** | Empty states, loading panels | Decorative | Avoid unless tied to data |
| **Blaze / VHS / Glitch** | Error / breach states | Too on-brand for finance UX | Avoid |
| **Laser** | Scroll reveal on long status pages | Could replace fade-ins | Consider for `/status` |
| **Clouds / Frost / Droplets** | Atmospheric backgrounds | Conflicts with calm institutional tone | Avoid |
| **Particle Object** | 3D logo or mascot | Not appropriate | Avoid |

#### 2.2 Priority order

1. **Ripple** on receipt-seal buttons and proof-stage completion.
2. **Glass** or **Magnify** in the Decision Dossier evidence block and MarketEdgeScanner odds comparison.
3. **Liquid** backdrop for the Reasoning Visualizer, recolored to the emerald/sealed palette.
4. **Particle Reveal** once on the landing decision instrument to dramatize the edge calculation.
5. Evaluate **Laser** for `/status` and `/world-cup` scroll reveals after the above.

#### 2.3 Implementation notes

- canvas-ui uses `shadcn@latest add @canvas-ui/<component>-react`. Project is already on Next.js 16 + React 19, but the docs site uses Tailwind v4 while Fourcast uses Tailwind v3.4.17. Components are self-contained source files; inspect and adapt class syntax rather than blindly adding.
- The `html-in-canvas` API requires Chrome/Edge 140+ with the experimental flag. In production, components fall back to WebGL overlays. Test the fallback path because financial users may be on locked-down browsers.
- Verify `prefers-reduced-motion`: canvas-ui components are expected to respect it, but confirm each copied component.
- The design system forbids continuous animation except for genuinely live indicators. Treat canvas effects as **state-change accents**, not ambient loops.

---

### 3. Concrete Next Steps

#### Quick wins (no new dependencies)
1. Collapse the Decision Dossier blocks into an accordion.
2. Make the Proof Theatre stages expandable and animate the spine progress.
3. Reduce the Reasoning Visualizer to three real phases and recolor to brand palette.
4. Move Builder Dashboard to a compact footer in Agent Dashboard.
5. On landing, default to search + instrument; defer audience doors and receipt section.

#### Medium effort (canvas-ui + progressive disclosure)
6. Add `Ripple` to "Inspect decision dossier" / seal actions.
7. Add `Glass`/`Magnify` lens to the Decision Dossier "What did the agent know?" block.
8. Replace the Reasoning Visualizer purple gradient with a low-opacity `Liquid` field in emerald/sealed tones.
9. Add a one-time `Particle Reveal` to the landing decision instrument.

#### Strategic
10. Define an **audience mode switch**: "Analyst" (market/edge first), "Operator" (mandate/receipt first), "Allocator" (diligence/reconciliation first). Persist the choice and re-order sections accordingly.
11. Establish a motion budget: only one canvas effect per viewport, never overlapping, always tied to a state change.

---

### 4. Anti-Patterns to Avoid

- Do not use canvas-ui as a page background; it competes with the evidence workspace genre.
- Do not add more than one continuous effect per screen.
- Do not let effects obscure hashes, timestamps, or policy text — these are trust signals.
- Do not rely on `html-in-canvas` without a WebGL fallback test.
- Do not add effects to the wallet connection, footer, or navigation — these are utility surfaces.

---

### 5. Files to Touch (ranked by impact)

1. `components/SearchLanding.js` — disclosure order, canvas reveal.
2. `components/MandateControl.js` — policy/telemetry disclosure, timeline animation.
3. `components/DecisionDossier.js` — accordion, evidence lens.
4. `components/ProofTheatre.js` — expandable stages, spine animation.
5. `components/AgentDashboard.js` — step/recommendation truncation.
6. `components/ReasoningVisualizer.js` — phase reduction, liquid backdrop.
7. `components/MarketEdgeScanner.js` — magnify lens on odds comparison.
8. `tokens.css` / design tokens — add motion-preference and canvas-safe opacity utilities if needed.
