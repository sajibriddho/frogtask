"use client";

/**
 * Forgot Password — single page, three-step flow.
 *
 * Step 1: Enter email address → server issues OTP via email.
 * Step 2: Enter 6-digit OTP → server returns a short-lived reset token.
 * Step 3: Enter a new password → server updates the password.
 *
 * State lives in component memory only; reloading the page starts over.
 * Rate limits and security rules are enforced server-side.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { AuthLayout } from "../_components/AuthLayout";

type Step = "email" | "otp" | "password" | "done";

interface ForgotResponse {
  emailMasked: string;
  expiresAt: string;
  resendInSeconds: number;
}

interface VerifyResponse {
  resetToken: string;
  expiresAt: string;
}

const OTP_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [emailMasked, setEmailMasked] = React.useState("");
  const [otpDigits, setOtpDigits] = React.useState<string[]>(
    Array(OTP_LENGTH).fill(""),
  );
  const [resetToken, setResetToken] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(null);
  const [resendIn, setResendIn] = React.useState(0);

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const otpInputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // ── Step handlers ─────────────────────────────────────────────────────

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ForgotResponse;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        throw new Error(json.error || "Could not send code");
      }
      setEmailMasked(json.data.emailMasked);
      setExpiresAt(new Date(json.data.expiresAt));
      setResendIn(json.data.resendInSeconds);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setStep("otp");
      toast.success("Verification code sent to your email.");
      setTimeout(() => otpInputsRef.current[0]?.focus(), 50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    setError(null);
    const fullCode = code ?? otpDigits.join("");
    if (fullCode.length !== OTP_LENGTH) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: fullCode }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: VerifyResponse;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        throw new Error(json.error || "Invalid code");
      }
      setResetToken(json.data.resetToken);
      setStep("password");
      toast.success("Code verified. Set a new password.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: { resendInSeconds: number; expiresAt: string };
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        throw new Error(json.error || "Could not resend code");
      }
      setResendIn(json.data.resendInSeconds);
      setExpiresAt(new Date(json.data.expiresAt));
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      otpInputsRef.current[0]?.focus();
      toast.success("A fresh code has been sent to your email.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resend failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("Password must include at least one letter and one digit.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: { email: string };
        error?: string;
      }>(res);
      if (!json.success) {
        throw new Error(json.error || "Could not reset password");
      }
      setStep("done");
      toast.success("Password updated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input helpers ─────────────────────────────────────────────────

  const updateDigit = (idx: number, val: string) => {
    const sanitized = val.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = sanitized;
      return next;
    });
    if (sanitized && idx < OTP_LENGTH - 1) {
      otpInputsRef.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpInputsRef.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0)
      otpInputsRef.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1)
      otpInputsRef.current[idx + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < Math.min(OTP_LENGTH, text.length); i++) {
      next[i] = text[i];
    }
    setOtpDigits(next);
    const nextIdx = Math.min(text.length, OTP_LENGTH - 1);
    otpInputsRef.current[nextIdx]?.focus();
    if (text.length >= OTP_LENGTH) {
      void handleVerifyOtp(next.join(""));
    }
  };

  const stepIdx =
    step === "email" ? 0 : step === "otp" ? 1 : step === "password" ? 2 : 3;

  return (
    <AuthLayout>
      {step !== "done" && (
        <>
          <div className="mb-6 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Step {stepIdx + 1} of 3
            </p>
            <h1 className="mt-1.5 text-xl sm:text-[22px] font-semibold text-foreground tracking-tight">
              {step === "email"
                ? "Reset your password"
                : step === "otp"
                  ? "Check your inbox"
                  : "Choose a new password"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {step === "email"
                ? "We'll email you a one-time code to verify it's you."
                : `Enter the 6-digit code sent to ${emailMasked || "your email"}.`}
            </p>
          </div>
          <StepDots current={stepIdx} total={3} />
        </>
      )}

      {/* Step 1 */}
      {step === "email" && (
        <form onSubmit={handleSendOtp} className="space-y-4 mt-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              autoFocus
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <Button
            type="submit"
            className="h-11 w-full rounded-xl text-sm font-semibold mt-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send code"
            )}
          </Button>

          <BackLink />
        </form>
      )}

      {/* Step 2 */}
      {step === "otp" && (
        <div className="space-y-4 mt-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Verification code
            </Label>
            <div className="flex gap-2 justify-between">
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpInputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={d}
                  onChange={(e) => updateDigit(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                  autoComplete="one-time-code"
                  className={cn(
                    "h-12 w-full rounded-xl border border-transparent bg-muted/70 text-center text-lg font-semibold tracking-wider text-foreground transition-colors",
                    "hover:bg-muted",
                    "focus-visible:bg-card focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none",
                  )}
                />
              ))}
            </div>
            {expiresAt && <OtpCountdown expiresAt={expiresAt} />}
          </div>

          {error && <ErrorBanner message={error} />}

          <Button
            type="button"
            className="h-11 w-full rounded-xl text-sm font-semibold mt-1"
            onClick={() => handleVerifyOtp()}
            disabled={loading || otpDigits.join("").length !== OTP_LENGTH}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0 || loading}
              className={cn(
                "font-medium transition-colors",
                resendIn > 0 || loading
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-primary hover:text-primary/80",
              )}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === "password" && (
        <form onSubmit={handleResetPassword} className="space-y-4 mt-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="new_password"
              className="text-sm font-medium text-foreground"
            >
              New password
            </Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                className="h-11 pr-11"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <PasswordStrength value={newPassword} />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="confirm_password"
              className="text-sm font-medium text-foreground"
            >
              Confirm password
            </Label>
            <Input
              id="confirm_password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              className="h-11"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-destructive">
                Passwords do not match.
              </p>
            )}
          </div>

          {error && <ErrorBanner message={error} />}

          <Button
            type="submit"
            className="h-11 w-full rounded-xl text-sm font-semibold mt-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl sm:text-[22px] font-semibold text-foreground tracking-tight">
            Password updated
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in with your new password to continue.
          </p>
          <Button
            className="mt-6 h-11 w-full rounded-xl text-sm font-semibold"
            onClick={() => router.push("/login")}
          >
            Continue to sign in
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <span
            key={i}
            className={cn(
              "h-1 rounded-full transition-all",
              active ? "w-6 bg-primary" : done ? "w-3 bg-primary/60" : "w-3 bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

function OtpCountdown({ expiresAt }: { expiresAt: Date }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remainingMs = Math.max(0, expiresAt.getTime() - now);
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  if (remainingMs <= 0) {
    return (
      <p className="text-xs text-destructive">
        Code expired. Resend to get a new one.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Expires in{" "}
      <span className="font-medium text-foreground tabular-nums">
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
    </p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      {message}
    </div>
  );
}

function BackLink() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Back to sign in
      </Link>
    </p>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const checks = [
    { label: "8+ characters", pass: value.length >= 8 },
    { label: "Letter", pass: /[A-Za-z]/.test(value) },
    { label: "Digit", pass: /\d/.test(value) },
    { label: "Symbol", pass: /[^A-Za-z0-9]/.test(value) },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const percent = (passed / checks.length) * 100;
  const color =
    passed <= 1
      ? "bg-destructive"
      : passed === 2
        ? "bg-amber-500"
        : passed === 3
          ? "bg-primary"
          : "bg-emerald-500";
  return (
    <div className="space-y-1.5 pt-1">
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        {checks.map((c) => (
          <li
            key={c.label}
            className={cn(
              "flex items-center gap-1",
              c.pass ? "text-emerald-600" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                c.pass ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
