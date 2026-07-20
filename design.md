# Design — Fourcast

A locked design system for the Fourcast platform. Pages share one evidence-led
visual language; individual routes vary through information structure, not
unrelated themes.

## Genre

Modern-minimal with an editorial diligence layer. The product should feel like
an institutional evidence workspace: precise, calm, independently auditable.

## Macrostructure family

- Marketing pages: Marquee Hero with a proof-chain narrative.
- App pages: Workbench with open sections, evidence rails, and inspectable rows.
- Content and status pages: Long Document with tabular operational sections.

## Theme

- `--color-paper`: lifted charcoal-green, never pitch black.
- `--color-paper-raised`: localized working surfaces, not universal cards.
- `--color-ink`: warm evidence paper.
- `--color-accent`: verification emerald, limited to live/verified/selected states.
- Evidence blue, sealed amber, breach red, and review violet are semantic only.

Canonical values live in `tokens.css` and must be referenced by token name.

## Typography

- Display: Syne, weight 600–700, roman.
- Body: DM Sans, weight 400–600.
- Mono: JetBrains Mono, weight 400–500.
- Mono is reserved for hashes, timestamps, policies, and state—not paragraphs.

## Spacing

Use the named 4-point scale in `tokens.css`. Major sections should breathe;
records and telemetry should remain compact.

## Motion

- UI transitions are crisp and generally below 300ms.
- Use motion for feedback, state indication, spatial consistency, or explanation.
- The signature motion is proof progression from sealed evidence to reconciliation.
- Continuous animation is reserved for genuinely live indicators.
- Animate transform and opacity; reduced motion removes displacement and keeps
  useful opacity/color feedback at 150ms or less.

## Microinteractions stance

- Pressable controls use subtle immediate scale feedback.
- Hover movement runs only on fine-pointer devices.
- Dynamic UI uses interruptible transitions rather than restart-prone keyframes.
- Success is shown in place; no celebratory toast or bounce.

## CTA voice

- Primary: emerald evidence action, square profile, verb-led copy.
- Secondary: quiet rule border with no elevation until interaction.

## Card policy

- Cards are reserved for actionable objects, selected records, errors, and modals.
- Page summaries, metrics, policies, fixtures, and positions use open sections,
  definition lists, evidence strips, and rows.
- Never nest more than one bordered container.

## Per-page allowances

- Marketing pages may use subtle CSS atmosphere.
- App pages derive visual interest from state and data, not decorative illustration.
- Dithered charts may be introduced only when backed by real historical data.

## What pages MUST share

- Lifted charcoal canvas and restrained atmospheric field.
- Syne, DM Sans, and JetBrains Mono role assignments.
- Verification emerald placement and semantic status colors.
- Workbench section rhythm and square CTA voice.
- The same motion tokens and reduced-motion behavior.

## What pages MAY differ on

- Density appropriate to the task.
- Horizontal versus vertical evidence progression.
- Whether records expand inline or open a dossier.

## Exports

The canonical CSS export is `tokens.css` at the project root.
