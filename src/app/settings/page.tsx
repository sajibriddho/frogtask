"use client";

/**
 * Settings hub — modern two-column layout with vertical tab nav on the left
 * and the active tab's form on the right.
 *
 * All persistence runs through /api/settings (one key/value document per
 * setting, scalable to new fields without schema changes).
 * Secrets (SMTP password) are encrypted at rest and masked in the client
 * as "********" until the user types over them.
 *
 * API:
 *   GET /api/settings            → bootstrap all scopes
 *   PUT /api/settings            → save a single scope
 *   POST /api/settings/upload    → logo / favicon upload
 *   GET /api/settings/backup     → full DB backup JSON
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  Building2,
  Phone,
  Mail,
  Database,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  Download,
  HardDrive,
  ShieldCheck,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  CircleDot,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { MASKED_PLACEHOLDER } from "@/lib/settings-catalogue";
import { refreshAppSettings, useAppSettings } from "@/hooks/useBranding";

// ── Types ───────────────────────────────────────────────────────────────

type Scope = "general" | "contact" | "email" | "system";

interface ScopePayload {
  scope: Scope;
  values: Record<string, unknown>;
  secretStatus: Record<string, boolean>;
  updatedAt: string | null;
}

interface AllScopes {
  general: ScopePayload;
  contact: ScopePayload;
  email: ScopePayload;
  system: ScopePayload;
}

// ── Constants ───────────────────────────────────────────────────────────

const TABS: {
  id: Scope;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "general",
    label: "General",
    description: "Company identity & branding",
    icon: Building2,
  },
  {
    id: "contact",
    label: "Contact Information",
    description: "How customers reach you",
    icon: Phone,
  },
  {
    id: "email",
    label: "Email Settings",
    description: "SMTP configuration",
    icon: Mail,
  },
  {
    id: "system",
    label: "System Management",
    description: "Alerts, backup & export",
    icon: Database,
  },
];

const LANGUAGES = [{ value: "en", label: "English" }];

/**
 * Every ISO 3166-1 alpha-2 country the current JS runtime knows about.
 * `Intl.supportedValuesOf("region")` returns the full set of region codes
 * and `Intl.DisplayNames` resolves each to an English country name.
 * A curated fallback keeps things working on older engines.
 */
const COUNTRIES: { value: string; label: string }[] = (() => {
  const codes: string[] = (() => {
    try {
      const fn = (
        Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
      ).supportedValuesOf;
      if (typeof fn === "function") {
        return fn("region").filter((c) => /^[A-Z]{2}$/.test(c));
      }
    } catch {
      /* fall through to curated fallback */
    }
    return [
      "AD",
      "AE",
      "AF",
      "AG",
      "AI",
      "AL",
      "AM",
      "AO",
      "AQ",
      "AR",
      "AS",
      "AT",
      "AU",
      "AW",
      "AX",
      "AZ",
      "BA",
      "BB",
      "BD",
      "BE",
      "BF",
      "BG",
      "BH",
      "BI",
      "BJ",
      "BL",
      "BM",
      "BN",
      "BO",
      "BQ",
      "BR",
      "BS",
      "BT",
      "BV",
      "BW",
      "BY",
      "BZ",
      "CA",
      "CC",
      "CD",
      "CF",
      "CG",
      "CH",
      "CI",
      "CK",
      "CL",
      "CM",
      "CN",
      "CO",
      "CR",
      "CU",
      "CV",
      "CW",
      "CX",
      "CY",
      "CZ",
      "DE",
      "DJ",
      "DK",
      "DM",
      "DO",
      "DZ",
      "EC",
      "EE",
      "EG",
      "EH",
      "ER",
      "ES",
      "ET",
      "FI",
      "FJ",
      "FK",
      "FM",
      "FO",
      "FR",
      "GA",
      "GB",
      "GD",
      "GE",
      "GF",
      "GG",
      "GH",
      "GI",
      "GL",
      "GM",
      "GN",
      "GP",
      "GQ",
      "GR",
      "GS",
      "GT",
      "GU",
      "GW",
      "GY",
      "HK",
      "HM",
      "HN",
      "HR",
      "HT",
      "HU",
      "ID",
      "IE",
      "IL",
      "IM",
      "IN",
      "IO",
      "IQ",
      "IR",
      "IS",
      "IT",
      "JE",
      "JM",
      "JO",
      "JP",
      "KE",
      "KG",
      "KH",
      "KI",
      "KM",
      "KN",
      "KP",
      "KR",
      "KW",
      "KY",
      "KZ",
      "LA",
      "LB",
      "LC",
      "LI",
      "LK",
      "LR",
      "LS",
      "LT",
      "LU",
      "LV",
      "LY",
      "MA",
      "MC",
      "MD",
      "ME",
      "MF",
      "MG",
      "MH",
      "MK",
      "ML",
      "MM",
      "MN",
      "MO",
      "MP",
      "MQ",
      "MR",
      "MS",
      "MT",
      "MU",
      "MV",
      "MW",
      "MX",
      "MY",
      "MZ",
      "NA",
      "NC",
      "NE",
      "NF",
      "NG",
      "NI",
      "NL",
      "NO",
      "NP",
      "NR",
      "NU",
      "NZ",
      "OM",
      "PA",
      "PE",
      "PF",
      "PG",
      "PH",
      "PK",
      "PL",
      "PM",
      "PN",
      "PR",
      "PS",
      "PT",
      "PW",
      "PY",
      "QA",
      "RE",
      "RO",
      "RS",
      "RU",
      "RW",
      "SA",
      "SB",
      "SC",
      "SD",
      "SE",
      "SG",
      "SH",
      "SI",
      "SJ",
      "SK",
      "SL",
      "SM",
      "SN",
      "SO",
      "SR",
      "SS",
      "ST",
      "SV",
      "SX",
      "SY",
      "SZ",
      "TC",
      "TD",
      "TF",
      "TG",
      "TH",
      "TJ",
      "TK",
      "TL",
      "TM",
      "TN",
      "TO",
      "TR",
      "TT",
      "TV",
      "TW",
      "TZ",
      "UA",
      "UG",
      "UM",
      "US",
      "UY",
      "UZ",
      "VA",
      "VC",
      "VE",
      "VG",
      "VI",
      "VN",
      "VU",
      "WF",
      "WS",
      "YE",
      "YT",
      "ZA",
      "ZM",
      "ZW",
    ];
  })();

  let displayName: ((code: string) => string | undefined) | null = null;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    displayName = (code) => dn.of(code);
  } catch {
    displayName = null;
  }

  return Array.from(new Set(codes))
    .map((code) => ({
      value: code,
      label: displayName?.(code) || code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
})();

const ENCRYPTION_OPTIONS = [
  { value: "tls", label: "TLS / STARTTLS (recommended)", port: 587 },
  { value: "ssl", label: "SSL", port: 465 },
  { value: "none", label: "None (plaintext)", port: 25 },
];

// ── Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [active, setActive] = React.useState<Scope>("general");
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [allData, setAllData] = React.useState<AllScopes | null>(null);
  const [saving, setSaving] = React.useState<Scope | null>(null);

  // Mutable working copies per scope (edits live here until saved).
  const [draft, setDraft] = React.useState<
    Record<Scope, Record<string, unknown>>
  >({} as Record<Scope, Record<string, unknown>>);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ScopePayload[];
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        setErr(json.error || "Failed to load settings");
        return;
      }
      const byScope = json.data.reduce<AllScopes>((acc, p) => {
        (acc as unknown as Record<string, ScopePayload>)[p.scope] = p;
        return acc;
      }, {} as AllScopes);
      setAllData(byScope);
      // Seed the draft with the loaded values.
      const d: Record<Scope, Record<string, unknown>> = {} as Record<
        Scope,
        Record<string, unknown>
      >;
      for (const p of json.data) d[p.scope] = { ...p.values };
      setDraft(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const setValue = (scope: Scope, key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [scope]: { ...(d[scope] ?? {}), [key]: value } }));
  };

  const saveScope = async (scope: Scope) => {
    if (!draft[scope]) return;
    setSaving(scope);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, values: draft[scope] }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ScopePayload;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to save");
        return;
      }
      setAllData((prev) =>
        prev ? ({ ...prev, [scope]: json.data! } as AllScopes) : prev,
      );
      setDraft((d) => ({ ...d, [scope]: { ...json.data!.values } }));
      // Invalidate the app-wide branding / public-settings cache so every
      // live consumer (sidebar, topbar, invoices, charts, etc.) re-renders
      // with the fresh values — no page reload needed.
      void refreshAppSettings();
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  // Detect dirty state by comparing draft against the last loaded
  // payload. Used to gate the sticky save bar.
  const isDirty = React.useCallback(
    (scope: Scope): boolean => {
      if (!allData) return false;
      const original = allData[scope]?.values ?? {};
      const current = draft[scope] ?? {};
      try {
        return JSON.stringify(current) !== JSON.stringify(original);
      } catch {
        return false;
      }
    },
    [allData, draft],
  );

  // Latest "Last updated" across all scopes — drives the page-header pill.
  const lastUpdated = React.useMemo(() => {
    if (!allData) return null;
    let latest: Date | null = null;
    for (const k of Object.keys(allData) as Scope[]) {
      const u = allData[k]?.updatedAt;
      if (!u) continue;
      const d = new Date(u);
      if (!latest || d > latest) latest = d;
    }
    return latest;
  }, [allData]);

  // ── Tab rendering ────────────────────────────────────────────────────

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading settings…
        </div>
      );
    }
    if (err) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Failed to load settings</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      );
    }
    if (!allData) return null;

    const tab = TABS.find((t) => t.id === active)!;
    const payload = allData[active];
    const values = draft[active] ?? {};
    const busy = saving === active;
    const dirty = isDirty(active);

    return (
      <div className="space-y-5">
        {/* Section hero */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
              <tab.icon className="h-5.5 w-5.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {tab.label}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {tab.description}
              </p>
              {payload.updatedAt && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <CircleDot className="h-2.5 w-2.5 text-primary" />
                  Last updated {new Date(payload.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="p-6 sm:p-7">
            {active === "general" && (
              <GeneralTab
                values={values}
                set={(k, v) => setValue("general", k, v)}
              />
            )}
            {active === "contact" && (
              <ContactTab
                values={values}
                set={(k, v) => setValue("contact", k, v)}
              />
            )}
            {active === "email" && (
              <EmailTab
                values={values}
                secretStatus={payload.secretStatus}
                set={(k, v) => setValue("email", k, v)}
              />
            )}
            {active === "system" && (
              <SystemTab
                values={values}
                set={(k, v) => setValue("system", k, v)}
              />
            )}
          </div>

          {/* Sticky save bar — only shown when this scope has a save action */}
          {active !== "system" && (
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-card/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <div className="flex items-center gap-2 text-xs">
                {dirty ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                    <span className="font-medium text-foreground">
                      Unsaved changes
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-muted-foreground">All changes saved</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => load()}
                  disabled={busy || !dirty}
                  className="rounded-xl h-9"
                >
                  Reset
                </Button>
                <Button
                  onClick={() => saveScope(active)}
                  disabled={busy || !dirty}
                  className="rounded-xl h-9"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>Save changes</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/8 via-card to-card p-6 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <SlidersHorizontal className="h-5.5 w-5.5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Settings
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Configure your platform. Changes apply immediately.
              </p>
            </div>
          </div>

          {lastUpdated && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                Updated{" "}
                <span className="text-foreground">
                  {lastUpdated.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-4 h-fit">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sections
            </p>
            <nav className="flex flex-col gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === active;
                const dirty = isDirty(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActive(tab.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {/* Active accent stripe */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
                      />
                    )}
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground shadow shadow-primary/30"
                          : "bg-muted text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{tab.label}</p>
                        {dirty && !isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-xs truncate",
                          isActive ? "text-primary/70" : "text-muted-foreground",
                        )}
                      >
                        {tab.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 transition-all",
                        isActive
                          ? "text-primary translate-x-0 opacity-100"
                          : "text-muted-foreground/40 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                      )}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Active tab content */}
        <div>{renderContent()}</div>
      </div>
    </div>
  );
}

// ── Reusable inputs ─────────────────────────────────────────────────────

function FieldRow({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SecretInput({
  id,
  value,
  hasValue,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  hasValue: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const displayValue =
    hasValue && !editing && value === MASKED_PLACEHOLDER
      ? MASKED_PLACEHOLDER
      : value;

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            if (value === MASKED_PLACEHOLDER) {
              onChange("");
              setEditing(true);
            }
          }}
          onChange={(e) => {
            setEditing(true);
            onChange(e.target.value);
          }}
          autoComplete="new-password"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hasValue && !editing && (
        <span className="self-center text-xs text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Stored
        </span>
      )}
    </div>
  );
}

function ImageUpload({
  id,
  kind,
  value,
  onChange,
  hint,
  aspect = "landscape",
  title,
}: {
  id: string;
  kind: "logo" | "favicon";
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  aspect?: "landscape" | "square";
  title?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);
      const res = await fetch("/api/settings/upload", {
        method: "POST",
        body: fd,
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: { url: string };
        error?: string;
      }>(res);
      if (json.success && json.data) {
        onChange(json.data.url);
        toast.success("Image uploaded");
      } else {
        toast.error(json.error || "Upload failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => inputRef.current?.click();

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
  };

  const accept = kind === "favicon" ? ".ico,.png,.svg" : "image/*";
  const acceptHint =
    kind === "favicon" ? "ICO · PNG · SVG, up to 2 MB" : "PNG · JPG · SVG";

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl bg-muted/50 transition-all",
          "hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          dragging && "bg-primary/10 ring-2 ring-primary/50",
          aspect === "landscape" ? "h-36 w-full" : "h-36 w-36",
        )}
        aria-label={
          value ? "Replace uploaded image" : "Click or drop a file to upload"
        }
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={title ?? kind}
              className="absolute inset-0 m-auto max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] object-contain"
            />
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                <Upload className="h-3 w-3" /> Replace
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <ImageIcon className="h-5 w-5" />
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                {dragging ? "Drop to upload" : "Click or drop file"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {acceptHint}
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {value && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={openPicker}
            disabled={uploading}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Replace
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onChange("")}
            disabled={uploading}
          >
            Remove
          </Button>
        </div>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Tab components ──────────────────────────────────────────────────────

interface TabProps {
  values: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}

interface SecretTabProps extends TabProps {
  secretStatus: Record<string, boolean>;
}

const str = (v: unknown, d = "") =>
  v === undefined || v === null ? d : String(v);
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const bool = (v: unknown) => v === true || v === "true";

function GeneralTab({ values, set }: TabProps) {
  return (
    <div className="space-y-8">
      {/* Identity */}
      <SectionGroup
        title="Identity"
        description="The name shown across the app, invoices, and emails."
      >
        <FieldRow label="Company Name" htmlFor="company_name" required>
          <Input
            id="company_name"
            value={str(values.company_name)}
            onChange={(e) => set("company_name", e.target.value)}
            placeholder="Your company name"
          />
        </FieldRow>
      </SectionGroup>

      {/* Brand assets */}
      <SectionGroup
        title="Brand assets"
        description="Upload your logo and favicon. Drag and drop, or click to browse."
      >
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
          <FieldRow
            label="Company Logo"
            hint="Displayed in the topbar and on printed documents. Recommended 512×128."
          >
            <ImageUpload
              id="company_logo"
              kind="logo"
              value={str(values.company_logo)}
              onChange={(url) => set("company_logo", url)}
            />
          </FieldRow>
          <FieldRow
            label="Favicon"
            hint="Browser tab icon, max 2 MB."
          >
            <ImageUpload
              id="company_favicon"
              kind="favicon"
              value={str(values.company_favicon)}
              onChange={(url) => set("company_favicon", url)}
              aspect="square"
            />
          </FieldRow>
        </div>
      </SectionGroup>

      {/* Localization */}
      <SectionGroup
        title="Localization"
        description="Default language and country for new records."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FieldRow label="Default Language" htmlFor="default_language">
            <SearchableSelect
              inputId="default_language"
              options={LANGUAGES}
              value={str(values.default_language, "en")}
              onChange={(v) => set("default_language", v ?? "en")}
              placeholder="Select a language"
            />
          </FieldRow>
          <FieldRow label="Default Country" htmlFor="default_country">
            <SearchableSelect
              inputId="default_country"
              options={COUNTRIES}
              value={str(values.default_country, "US")}
              onChange={(v) => set("default_country", v ?? "US")}
              placeholder="Select a country"
            />
          </FieldRow>
        </div>
      </SectionGroup>
    </div>
  );
}

/** Shared section group with a small caption + subtitle and a separator line above. */
function SectionGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          {title}
        </p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function ContactTab({ values, set }: TabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FieldRow label="Phone Number" htmlFor="phone">
          <Input
            id="phone"
            type="tel"
            value={str(values.phone)}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 555 123 4567"
          />
        </FieldRow>
        <FieldRow label="Email Address" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={str(values.email)}
            onChange={(e) => set("email", e.target.value)}
            placeholder="contact@example.com"
          />
        </FieldRow>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <FieldRow label="Website" htmlFor="website">
          <Input
            id="website"
            type="url"
            value={str(values.website)}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://example.com"
          />
        </FieldRow>
        <FieldRow
          label="Business Hours"
          htmlFor="business_hours"
          hint="Free-form, shown on invoices and receipts."
        >
          <Input
            id="business_hours"
            value={str(values.business_hours)}
            onChange={(e) => set("business_hours", e.target.value)}
            placeholder="Mon-Fri 9:00-17:00"
          />
        </FieldRow>
      </div>
      <FieldRow label="Address" htmlFor="address">
        <Textarea
          id="address"
          rows={3}
          value={str(values.address)}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Street, City, State, ZIP, Country"
        />
      </FieldRow>
    </div>
  );
}

function EmailTab({ values, secretStatus, set }: SecretTabProps) {
  const enabled = bool(values.enabled);
  const authRequired = bool(values.auth_required);
  const [testTo, setTestTo] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [testResult, setTestResult] = React.useState<
    { ok: boolean; message: string } | null
  >(null);

  const handleTest = async (mode: "verify" | "send") => {
    setTestResult(null);
    if (mode === "send" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim())) {
      setTestResult({
        ok: false,
        message: "Please enter a valid email address to receive the test message.",
      });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "send" ? { to: testTo.trim() } : {}),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: { messageId?: string; verifiedOnly?: boolean };
        error?: string;
      }>(res);
      if (json.success) {
        const msg = json.data?.verifiedOnly
          ? "SMTP connection verified successfully."
          : `Test email sent${json.data?.messageId ? ` (ID ${json.data.messageId})` : ""}.`;
        setTestResult({ ok: true, message: msg });
        toast.success(
          json.data?.verifiedOnly ? "SMTP verified" : "Test email sent",
        );
      } else {
        setTestResult({ ok: false, message: json.error || "Test failed" });
        toast.error(json.error || "Test failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Test failed";
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const lastVerifiedAt = str(values.last_verified_at);
  const lastVerifiedStatus = str(values.last_verified_status);

  return (
    <form
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
      className="space-y-6"
    >
      <input
        type="text"
        name="prevent_autofill"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <input
        type="password"
        name="prevent_autofill_password"
        autoComplete="new-password"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />

      <ToggleRow
        label="Enable Email Notifications"
        description="Master switch for all outgoing mail: invoices, payment receipts, password resets and alerts."
        checked={enabled}
        onChange={(v) => set("enabled", v)}
      />

      {enabled && (
        <>
          <div className="space-y-6 rounded-lg border bg-muted/20 p-5">
            <Alert variant="info">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>SMTP Configuration</AlertTitle>
              <AlertDescription>
                Credentials are read live from the server on every send. Your
                password is encrypted at rest with AES-256-GCM and never sent
                to the browser after saving.
              </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <FieldRow
                  label="SMTP Host"
                  htmlFor="smtp_host"
                  required
                  hint="Your mail server hostname, e.g. smtp.gmail.com or mail.yourdomain.com."
                >
                  <Input
                    id="smtp_host"
                    value={str(values.smtp_host)}
                    onChange={(e) => set("smtp_host", e.target.value)}
                    placeholder="smtp.example.com"
                    autoComplete="off"
                  />
                </FieldRow>
              </div>
              <FieldRow
                label="SMTP Port"
                htmlFor="smtp_port"
                required
                hint="465 for SSL, 587 for TLS, 25 for plain."
              >
                <Input
                  id="smtp_port"
                  type="number"
                  min={1}
                  max={65535}
                  value={num(values.smtp_port, 587)}
                  onChange={(e) => set("smtp_port", Number(e.target.value) || 0)}
                  autoComplete="off"
                />
              </FieldRow>
            </div>

            <FieldRow
              label="Encryption"
              htmlFor="encryption"
              hint="TLS/STARTTLS (port 587) is the recommended default. Changing this auto-updates the port."
            >
              <SearchableSelect
                inputId="encryption"
                options={ENCRYPTION_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={str(values.encryption, "tls")}
                onChange={(v) => {
                  const next = v ?? "tls";
                  set("encryption", next);
                  const preset = ENCRYPTION_OPTIONS.find((o) => o.value === next);
                  if (preset) set("smtp_port", preset.port);
                }}
                placeholder="Select encryption"
              />
            </FieldRow>

            <div
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl p-4 transition-colors",
                authRequired
                  ? "bg-primary/5 ring-1 ring-primary/20"
                  : "bg-muted/50 hover:bg-muted",
              )}
            >
              <div className="min-w-0 pr-2">
                <Label className="text-sm font-semibold text-foreground">
                  Require authentication
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Turn off only if your SMTP relay accepts mail anonymously
                  from this server (rare in production).
                </p>
              </div>
              <Switch
                checked={authRequired}
                onCheckedChange={(v) => set("auth_required", v)}
              />
            </div>

            {authRequired && (
              <div className="grid gap-6 md:grid-cols-2">
                <FieldRow
                  label="SMTP Username"
                  htmlFor="smtp_username"
                  required
                  hint="Usually your full email address."
                >
                  <Input
                    id="smtp_username"
                    value={str(values.smtp_username)}
                    onChange={(e) => set("smtp_username", e.target.value)}
                    placeholder="no-reply@example.com"
                    autoComplete="off"
                  />
                </FieldRow>
                <FieldRow
                  label="SMTP Password"
                  htmlFor="smtp_password"
                  hint="Stored encrypted. Leave as displayed to keep the current value."
                  required
                >
                  <SecretInput
                    id="smtp_password"
                    value={str(values.smtp_password)}
                    hasValue={!!secretStatus.smtp_password}
                    onChange={(v) => set("smtp_password", v)}
                    placeholder="Enter to change"
                  />
                </FieldRow>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <FieldRow
                label="From Name"
                htmlFor="from_name"
                hint="Display name shown as the sender (e.g. your company name)."
              >
                <Input
                  id="from_name"
                  value={str(values.from_name)}
                  onChange={(e) => set("from_name", e.target.value)}
                  placeholder="Your company name"
                  autoComplete="off"
                />
              </FieldRow>
              <FieldRow
                label="From Email Address"
                htmlFor="from_email"
                required
                hint="The address that appears as the sender on all outgoing mail."
              >
                <Input
                  id="from_email"
                  type="email"
                  value={str(values.from_email)}
                  onChange={(e) => set("from_email", e.target.value)}
                  placeholder="no-reply@example.com"
                  autoComplete="off"
                />
              </FieldRow>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <FieldRow
                label="Reply-To Email"
                htmlFor="reply_to"
                hint="Optional. Recipients' replies go here instead of the From address."
              >
                <Input
                  id="reply_to"
                  type="email"
                  value={str(values.reply_to)}
                  onChange={(e) => set("reply_to", e.target.value)}
                  placeholder="support@example.com"
                  autoComplete="off"
                />
              </FieldRow>
              <FieldRow
                label="Timeout (sec)"
                htmlFor="timeout_seconds"
                hint="Abort the SMTP handshake if the server stalls."
              >
                <Input
                  id="timeout_seconds"
                  type="number"
                  min={5}
                  max={120}
                  value={num(values.timeout_seconds, 20)}
                  onChange={(e) =>
                    set("timeout_seconds", Number(e.target.value) || 0)
                  }
                  autoComplete="off"
                />
              </FieldRow>
            </div>

            {/* ── Test SMTP connection / send test email ───────────────── */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-sm">Verify SMTP settings</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Save first, then either verify the connection or send a
                    branded test message to confirm delivery end-to-end.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTest("verify")}
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Verify connection
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleTest("send")}
                  disabled={sending || !testTo.trim()}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send test email
                </Button>
              </div>
              {testResult && (
                <Alert variant={testResult.ok ? "info" : "destructive"}>
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {testResult.ok ? "Success" : "Could not send"}
                  </AlertTitle>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}
              {lastVerifiedAt && (
                <p className="text-xs text-muted-foreground">
                  Last verified {new Date(lastVerifiedAt).toLocaleString()}
                  {lastVerifiedStatus ? ` — ${lastVerifiedStatus}` : ""}
                </p>
              )}
            </div>
          </div>

        </>
      )}
    </form>
  );
}

function SystemTab(_props: TabProps) {
  void _props;
  const [busy, setBusy] = React.useState(false);

  const handleBackup = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body.slice(0, 120) || `Request failed: ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "database-backup.json";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Database backup downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Database Backup</h3>
          <p className="text-xs text-muted-foreground">
            Downloads every collection in the database as a single MongoDB
            Extended JSON (v2, canonical) file. The format preserves ObjectIds,
            dates and other BSON types so the backup can be re-imported directly
            into MongoDB.
          </p>
        </div>

        <div className="rounded-lg border p-5 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <HardDrive className="h-4 w-4 text-primary" /> Full Database
            Snapshot
          </div>
          <p className="text-xs text-muted-foreground mb-4 max-w-xl">
            Includes master data, transactions, inventory, accounting entries
            and system metadata. Keep this file somewhere safe — it contains
            every business record.
          </p>
          <Button onClick={handleBackup} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing
                backup…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Download database backup
              </>
            )}
          </Button>
        </div>
      </section>

      <Alert variant="info">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>How to restore into MongoDB</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            The backup is saved in MongoDB Extended JSON format, which keeps
            every ObjectId, date and BSON type intact for a clean re-import. To
            restore:
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>
              Open your target database in MongoDB Compass (or another Mongo
              client).
            </li>
            <li>
              For each collection in the downloaded file, create a collection
              with the same name if it does not already exist.
            </li>
            <li>
              Use the client&apos;s <em>Import Data</em> option, select the JSON
              file, and choose the matching collection. Compass recognises
              Extended JSON automatically.
            </li>
            <li>
              If you prefer the command line, use <strong>mongorestore</strong>{" "}
              with the <strong>--drop --preserveUUID</strong> flags to overwrite
              the target database with the backup data.
            </li>
            <li>
              Always test the restore on a staging database before running it
              against production.
            </li>
          </ol>
        </AlertDescription>
      </Alert>

      <DangerZone />
    </div>
  );
}

// ── Danger Zone: full system reset ──────────────────────────────────────

interface ProfileSummary {
  can_delete: boolean;
}

function DangerZone() {
  const [profile, setProfile] = React.useState<ProfileSummary | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await parseJsonSafe<{
          success: boolean;
          data?: { can_delete?: boolean };
        }>(res);
        if (cancelled) return;
        if (json.success && json.data) {
          setProfile({ can_delete: json.data.can_delete !== false });
        }
      } catch {
        /* silent — we just hide the section if we can't tell */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only the protected system user may see this section.
  if (!profile || profile.can_delete !== false) return null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
        <p className="text-xs text-muted-foreground">
          Destructive operations. Only the protected system administrator can
          see and run these.
        </p>
      </div>

      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-sm font-medium mb-1 text-destructive">
          <ShieldAlert className="h-4 w-4" /> Reset whole system
        </div>
        <p className="text-xs text-muted-foreground mb-4 max-w-xl">
          Downloads a full database backup to your computer, wipes every
          collection in the database, re-runs the seed script, and logs you
          out. After the reset you will sign in with the default seeded
          administrator credentials. This cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset whole system
        </Button>
      </div>

      <ResetSystemDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}

function ResetSystemDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { companyName } = useAppSettings();
  const [typedName, setTypedName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [busyStep, setBusyStep] = React.useState<
    "idle" | "downloading" | "resetting" | "done"
  >("idle");
  const [err, setErr] = React.useState<string | null>(null);

  // Randomised field names defeat Chrome / Safari showing saved-value
  // suggestions — browsers match on `name` + origin, so a fresh name has
  // no history to offer. Re-generated every time the dialog opens.
  const fieldNames = React.useMemo(
    () => ({
      company: `reset-company-${Math.random().toString(36).slice(2, 10)}`,
      password: `reset-password-${Math.random().toString(36).slice(2, 10)}`,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  // Reset form state every time the dialog is closed so a second open starts
  // clean — avoids leaving the password sitting in memory.
  React.useEffect(() => {
    if (!open) {
      setTypedName("");
      setPassword("");
      setShowPassword(false);
      setErr(null);
      setBusyStep("idle");
    }
  }, [open]);


  const nameMatches =
    typedName.trim().toLowerCase() === companyName.trim().toLowerCase() &&
    typedName.trim().length > 0;
  const canSubmit = nameMatches && password.length > 0 && !busy;

  const downloadBackup = async () => {
    const res = await fetch("/api/settings/backup");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        body.slice(0, 160) || `Backup download failed: ${res.status}`,
      );
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? "database-backup.json";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      // 1. Download the full backup to the admin's machine first. If this
      //    step fails we abort before touching the database.
      setBusyStep("downloading");
      await downloadBackup();

      // 2. Drop + reseed on the server.
      setBusyStep("resetting");
      const res = await fetch("/api/system/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, companyName: typedName }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        error?: string;
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Reset failed");
      }

      // 3. Surface a success dialog for a beat before signing out so the
      //    admin sees confirmation rather than an abrupt redirect.
      setBusyStep("done");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 4. Sign out — the session points at a user that no longer exists.
      await signOut({ callbackUrl: "/login" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed");
      setBusy(false);
      setBusyStep("idle");
    }
  };

  return (
    <>
      <ResetProgressOverlay open={busy} step={busyStep} />
      <Dialog
        open={open && !busy}
        onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}
      >
        <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Reset whole system</DialogTitle>
              <DialogDescription>
                This wipes every record and re-seeds defaults.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          {/*
           * Decoy fields with matching names eat Chrome's first autofill
           * attempt so the real fields below never receive a suggestion.
           * They must be in the DOM (not `display:none`) but kept off
           * screen and unfocusable. Keep this pair at the very top.
           */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Irreversible action</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>On confirm the following will happen:</p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1 text-xs">
                <li>Download the full database backup to your computer.</li>
                <li>Drop every collection in the database.</li>
                <li>
                  Re-run <code>npm run seed</code> to recreate defaults.
                </li>
                <li>Sign you out so you can log in as the seeded admin.</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="reset-company">
              Type the company name to confirm
            </Label>
            <div className="text-xs text-muted-foreground">
              Expected:{" "}
              <span className="font-semibold text-foreground">
                {companyName || "—"}
              </span>
            </div>
            <Input
              id="reset-company"
              name={fieldNames.company}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={companyName}
              autoComplete="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              disabled={busy}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reset-password">Your login password</Label>
            <div className="relative">
              <Input
                id="reset-password"
                name={fieldNames.password}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                disabled={busy}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {err && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              {busyStep === "downloading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Downloading
                  backup…
                </>
              ) : busyStep === "resetting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset system
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Non-dismissable overlay shown while the reset is running. Mirrors the
 * `LocationGuard` pattern — uses Radix primitives directly (bypassing the
 * shared `DialogContent` wrapper so no X close button is rendered) and
 * blocks Escape / outside-click / interaction-outside. There is no way
 * for the user to dismiss it; the overlay only disappears when the
 * reset either succeeds (signOut navigates away) or fails (busy flips
 * back to false in the parent).
 */
function ResetProgressOverlay({
  open,
  step,
}: {
  open: boolean;
  step: "idle" | "downloading" | "resetting" | "done";
}) {
  const block = (e: Event) => e.preventDefault();

  const isDone = step === "done";
  const title = isDone ? "System reset complete" : "Please wait";
  const message = isDone
    ? "Redirecting to login…"
    : step === "downloading"
      ? "Downloading database backup…"
      : "Resetting the system…";

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          className={cn(
            "fixed left-[50%] top-[50%] z-[60] w-full max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border bg-background shadow-2xl p-6",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full mb-4",
                isDone
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : (
                <Loader2 className="h-7 w-7 animate-spin" />
              )}
            </div>
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">
              {message}
            </DialogPrimitive.Description>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl p-4 transition-colors",
        checked
          ? "bg-primary/5 ring-1 ring-primary/20"
          : "bg-muted/50 hover:bg-muted",
      )}
    >
      <div className="min-w-0 pr-2">
        <Label className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
