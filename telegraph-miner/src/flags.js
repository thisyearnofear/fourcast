/**
 * Feature flags — one mechanism, no magic.
 *
 * A flag is on when the env var is exactly the string 'true'. Everything else
 * — unset, '1', 'yes', 'TRUE' — is off. New behaviour ships dark behind a
 * flag and fails closed: a flag-gated handler refuses with a reason string,
 * it never pretends to do the work.
 */

export function isEnabled(name, env = process.env) {
  return env?.[name] === 'true';
}
