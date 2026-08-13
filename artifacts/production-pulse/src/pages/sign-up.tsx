import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";
import { supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

export default function SignUp() {
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Surfaced by UserMenu; Supabase stores it on the user record.
        data: { full_name: fullName.trim() },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    // When email confirmation is enabled, signUp succeeds but returns no
    // session — the user has to click the link before they can sign in.
    if (!data.session) {
      setNeedsConfirmation(true);
      setIsSubmitting(false);
      return;
    }

    setLocation("/dashboard");
  }

  if (needsConfirmation) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="One more step before you can sign in"
        footer={
          <Link href="/sign-in" className="text-primary hover:underline font-medium">
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <MailCheck className="w-8 h-8 text-primary" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="text-foreground font-medium">{email}</span>. Open it
            to activate your account.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Join Production Pulse"
      subtitle="Create an account to start managing your projects"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName" className="text-sm font-medium">
            Full name
          </Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-sm"
          />
          <p className="text-xs text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-sm px-3 py-2"
          >
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] rounded-sm h-10 font-medium mt-2"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
