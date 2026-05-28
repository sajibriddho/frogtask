"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthLayout } from "../_components/AuthLayout";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const REMEMBER_KEY = "frogtask:remember-me";

interface RememberData {
  email: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [capsLockOn, setCapsLockOn] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);

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
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Restore the remembered email on first paint so the field is already
  // filled when the user lands here. Wrapped in try/catch in case the
  // storage is unavailable (private mode, quota exceeded, …).
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RememberData;
      if (parsed?.email) {
        setValue("email", parsed.email);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, [setValue]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        // `authorize()` in `auth-options.ts` throws specific error names for
        // accounts that exist but aren't usable yet. Map them to friendly
        // copy. Anything else (wrong password, unknown email, bad request)
        // collapses into the generic invalid-credentials message so we
        // don't leak which emails are registered.
        const code = result.error;
        if (code === "AccountPending") {
          toast.error(
            "Your account is awaiting admin approval. You'll be notified once it's activated.",
            { duration: 6000 },
          );
        } else if (code === "AccountInactive") {
          toast.error(
            "This account has been deactivated. Please contact an administrator to reactivate it.",
            { duration: 6000 },
          );
        } else {
          toast.error("Invalid email or password. Please try again.");
        }
      } else {
        // Persist (or clear) the remembered email AFTER a successful sign-in
        // so we don't leak the email when the credentials were wrong.
        try {
          if (rememberMe) {
            window.localStorage.setItem(
              REMEMBER_KEY,
              JSON.stringify({ email: data.email } as RememberData),
            );
          } else {
            window.localStorage.removeItem(REMEMBER_KEY);
          }
        } catch {
          /* ignore */
        }
        toast.success("Login successful!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      {/* Heading */}
      <div className="mb-6 text-center">
        <h1 className="text-xl sm:text-[22px] font-semibold text-foreground tracking-tight">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Let&apos;s get to it.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
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
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
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
          {capsLockOn && !errors.password && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Caps Lock is on
            </p>
          )}
        </div>

        {/* Remember me */}
        <label
          htmlFor="remember-me"
          className="flex cursor-pointer items-center gap-2 select-none"
        >
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={setRememberMe}
          />
          <span className="text-sm text-muted-foreground">Remember me</span>
        </label>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-sm font-semibold mt-1"
          disabled={isLoading}
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>

        <p className="pt-1 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
