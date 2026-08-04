# Design — Fourcast

A locked design system for the Fourcast platform. Pages share one evidence-led
visual language; individual routes vary through information structure, not
unrelated themes.

## Genre

Modern-minimal venue with an evidence layer on demand. The product should feel
like a prediction-market workbench you already know — act first, prove second —
precise, calm, independently auditable.

## Macrostructure family

- Marketing pages: Canton wedge hero, then compact venue doors.
- App pages: Workbench with open sections, dense rows, evidence on expand.
- Content and status pages: Long Document with tabular operational sections.

## Density & venue voice

Act → confirm → prove. Primary number and primary CTA above the fold; evidence
one tap away. Trade language leads (`Markets`, `Positions`, `Private`, `Settle`,
`Claim`); proof language appears on demand (`Privacy check`, `Receipt`,
`Raw ledger`).

1. One job per section — no duplicate kickers, mode hints, or step rails on
   default views.
2. Subtitle budget — max ~12 words; omit when tabs already explain.
3. Badges ≤ 2 per row until expand; rest in detail.
4. JSON / hashes collapsed by default behind “Raw ledger”.
5. Mobile — one primary CTA under the hero metric; no multi-paragraph helpers
   in the first viewport.
6. Primary nav — Markets · Positions · Private. Overflow holds Signals,
   Mandate, Labs, Alerts.

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
