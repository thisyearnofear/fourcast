---
workflow: general-video
flow: automation
storyboard: no
message: "On public prediction markets, your size is a signal everyone can read — Fourcast fixes the venue, not the trader, with ledger-enforced position privacy and atomic CBTC settlement on Canton"
destination: x-feed
aspect: 1920x1080
language: en
length: 30s
angle: problem-agitate-solve
narration: yes
audience: prediction-market traders, sharps, market makers, sports bettors
---

## Intent

A 30-second trailer for a tweet about Fourcast — private prediction markets on
Canton (Daml signatory privacy + atomic CBTC settlement). The trailer opens
with the visceral pain of public prediction markets (your position is visible,
copied, front-run, you get limited when you're right), reveals the fix
(privacy enforced at the ledger, not the policy layer — atomic settlement in
real CBTC), and ends with a call to action pointing to the live proof wall.
Voiceover via ElevenLabs-style TTS (Kokoro local fallback), background music
bed throughout. Visual language: kinetic typography on the Fourcast dark
charcoal-green canvas with emerald accent, using the existing design-system
motion vocabulary (fc-ledger-enter, mc-proof-flash, fc-reconciled-stamp).

## Assets

- tokens.css — Fourcast design tokens (color, spacing, typography, motion)
- Fourcast design system classes (fc-ledger-enter, mc-proof-flash, fc-reconciled-stamp, mc-seal-flash) — referenced for motion vocabulary

## Customizations

- Kinetic typography treatment for the three-beat pain structure ("Copied on entry / Front-run on exit / Limited when you're right")
- Proof-crossing sweep animation (mc-proof-flash) as the transition from problem to solution
- Ledger-enter row animation (fc-ledger-enter) for the "position appears" moment
- Reconciled stamp glow (fc-reconciled-stamp) for the settlement beat
- Narrated voiceover (Kokoro TTS local, ~30s script)
- Background music bed (resolved via media-use)

## Notes

- The tweet content drives the script — the three-beat pain rhythm is the
  core structure
- Design must match Fourcast: lifted charcoal-green canvas (--color-paper),
  warm evidence ink, verification emerald accent (--color-accent), Syne for
  display, DM Sans for body, JetBrains Mono for hashes/state
- Square profiles, no rounded cards, hairline rules — institutional evidence
  workspace feel
- The proof link fourcastapp.vercel.app/proof?chain=canton should appear at the end
- #HackCanton hashtag in the closing frame
