/**
 * Settings catalogue – single source of truth for which keys live in which
 * scope, which are secrets, and what their defaults are.
 *
 * Adding a new setting? Register it here — the API and UI both honour this
 * catalogue for validation, masking, and default-population on first load.
 */

export interface SettingField {
  key: string;
  defaultValue: string | number | boolean | null;
  isSecret?: boolean;
}

export type SettingsShape = Record<string, SettingField[]>;

export const MASKED_PLACEHOLDER = "********";

export const SETTINGS_CATALOGUE: SettingsShape = {
  general: [
    { key: "company_name", defaultValue: "Frogtask" },
    { key: "company_logo", defaultValue: "" },
    { key: "company_favicon", defaultValue: "" },
    { key: "default_language", defaultValue: "en" },
    { key: "default_country", defaultValue: "US" },
  ],

  contact: [
    { key: "phone", defaultValue: "" },
    { key: "email", defaultValue: "" },
    { key: "website", defaultValue: "" },
    { key: "business_hours", defaultValue: "Mon-Fri 9:00-17:00" },
    { key: "address", defaultValue: "" },
  ],

  email: [
    { key: "enabled", defaultValue: false },
    { key: "smtp_host", defaultValue: "" },
    { key: "smtp_port", defaultValue: 587 },
    { key: "smtp_username", defaultValue: "" },
    { key: "smtp_password", defaultValue: "", isSecret: true },
    { key: "from_email", defaultValue: "" },
    { key: "from_name", defaultValue: "" },
    { key: "reply_to", defaultValue: "" },
    { key: "encryption", defaultValue: "tls" }, // "ssl" | "tls" | "none"
    { key: "auth_required", defaultValue: true },
    { key: "timeout_seconds", defaultValue: 20 },
    { key: "last_verified_at", defaultValue: "" },
    { key: "last_verified_status", defaultValue: "" },
  ],

  // "system" scope has no persisted fields — it is action-only (backup).
  // Left as an empty list so the scope is a recognised key; no documents
  // will ever be written.
  system: [],
};

/** Lookup: is this (scope, key) a secret? O(1) after first call. */
const secretLookup = (() => {
  const set = new Set<string>();
  for (const [scope, fields] of Object.entries(SETTINGS_CATALOGUE)) {
    for (const f of fields) {
      if (f.isSecret) set.add(`${scope}:${f.key}`);
    }
  }
  return set;
})();

export function isSecretField(scope: string, key: string): boolean {
  return secretLookup.has(`${scope}:${key}`);
}

/** Is a scope registered in the catalogue? */
export function isKnownScope(scope: string): boolean {
  return Object.prototype.hasOwnProperty.call(SETTINGS_CATALOGUE, scope);
}

/** All (scope, key) pairs flattened — useful for bootstrap / tests. */
export function listAllFields(): { scope: string; field: SettingField }[] {
  const out: { scope: string; field: SettingField }[] = [];
  for (const [scope, fields] of Object.entries(SETTINGS_CATALOGUE)) {
    for (const f of fields) out.push({ scope, field: f });
  }
  return out;
}

/** Default values keyed by `scope.key` — used to seed the UI pre-fetch. */
export function defaultsFor(scope: string): Record<string, SettingField["defaultValue"]> {
  const out: Record<string, SettingField["defaultValue"]> = {};
  for (const f of SETTINGS_CATALOGUE[scope] ?? []) out[f.key] = f.defaultValue;
  return out;
}
