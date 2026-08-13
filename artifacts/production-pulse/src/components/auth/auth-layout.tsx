import { Link } from "wouter";
import { Film } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared shell for the sign-in and sign-up pages. Mirrors the marketing header
 * on the home page so the transition between them is seamless.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-[hsl(349_73%_44%)] selection:text-white">
      <header className="px-6 md:px-12 py-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2 text-foreground w-fit">
          <Film className="w-6 h-6 text-primary" />
          <span className="font-serif font-semibold text-lg tracking-tight">
            Production Pulse
          </span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground mb-2">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="border border-border rounded-sm bg-card p-6 shadow-sm">
            {children}
          </div>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {footer}
          </p>
        </div>
      </main>
    </div>
  );
}
