"use client";

/**
 * Register page — public sign-up form.
 *
 * Submits to POST /api/auth/register and creates the account with
 * status="Active". On success, the user is automatically signed in via
 * NextAuth's `signIn("credentials", …)` and redirected to `/dashboard`.
 * No admin approval is needed for self-registered accounts.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { AuthLayout } from "../_components/AuthLayout";

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Please enter your full name")
      .max(100, "Name must be 100 characters or less"),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must include a letter")
      .regex(/\d/, "Password must include a digit"),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [capsLockOn, setCapsLockOn] = React.useState(false);

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const on =
      typeof e.getModifierState === "function"
        ? e.getModifierState("CapsLock")
        : false;
    setCapsLockOn(on);
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });
  const passwordValue = watch("password") ?? "";

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      // Step 1 — create the account (server returns it as Active).
      const email = data.email.trim().toLowerCase();
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          email,
          password: data.password,
        }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: { email: string };
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Could not create account.");
        return;
      }

      // Step 2 — sign the brand-new user in with the credentials they
      // just typed. We stay on this page (`redirect: false`) so we can
      // route to the dashboard ourselves and show a friendly toast.
      // The `setIsLoading(false)` in `finally` would normally fire
      // before the navigation completes — but since we're navigating
      // immediately, the spinner disappears as the page changes.
      const signin = await signIn("credentials", {
        email,
        password: data.password,
        redirect: false,
      });

      if (signin?.error) {
        // Edge case: account was created but auto-login failed (e.g.
        // transient DB hiccup). Send them to /login with their email
        // pre-filled mentally — they can sign in manually.
        toast.success("Account created. Please sign in.");
        router.push("/login");
        return;
      }

      toast.success("Welcome aboard! Redirecting to your dashboard…");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Form ─────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-xl sm:text-[22px] font-semibold text-foreground tracking-tight">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign up and start planning in seconds.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label
            htmlFor="name"
            className="text-sm font-medium text-foreground"
          >
            Full name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            autoFocus
            className="h-11"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            className="h-11"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              onKeyUp={onPasswordKey}
              onKeyDown={onPasswordKey}
              className="h-11 pr-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
          {passwordValue && !errors.password && (
            <PasswordStrength value={passwordValue} />
          )}
          {capsLockOn && !errors.password && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Caps Lock is on
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-foreground"
          >
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            className="h-11"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-sm font-semibold mt-1"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
              account…
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="pt-1 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ── Password strength meter ──────────────────────────────────────────────

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
            {c.pass ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            )}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
