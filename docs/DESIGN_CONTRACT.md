# Design contract — the rules a surface cannot break

Twenty lines, not a style guide. `tokens.css` and `design.md` hold the system;
this file holds the invariants the quality bar enforces (see
`EXECUTION_PLAN.md` → Surface quality bar). A new surface is built to this
once, not retrofitted.

1. **Colour by name, never literal.** No `#hex`, `rgb()`, or `hsl()` in
   `components/` or `app/`. Semantic tokens only: `ink`/`ink-muted`/`ink-faint`,
   `rule`/`rule-strong`, `accent`, `evidence`, `breach`, `sealed`, `paper-*`.
   Emerald means *verified* — do not spend it on decoration.
2. **Zero radius.** Sharp corners everywhere. No `rounded` unless the token
   provides it (status pills are the documented exception).
3. **Mono for evidence.** Numbers that are claims — sizes, latencies, hashes,
   hit rates, blob/object ids — render in `--font-mono`. Prose does not.
4. **`NA` over `0`.** An absent value is `—`/`NA`/a stated reason, never a
   confident zero, an empty string dressed as a status, or a guessed name.
5. **Three states, always.** Every data surface renders loading, empty and
   error — and the empty state says *why* it is empty.
6. **`verified: true` means a real Merkle root.** Nothing else earns the word.
7. **One job per section, one `<h1>` per route, one primary CTA** — verb-led,
   square, emerald.
8. **Evidence is one tap.** Every claim row expands to its receipt, hash, or
   raw ledger. A claim you cannot expand is a claim you cannot audit.
9. **The floor:** `:focus-visible` on every control, accessible names,
   reduced motion honoured, AA contrast on body text.
