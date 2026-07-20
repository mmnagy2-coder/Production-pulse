import { Link, useLocation } from "wouter";
import { Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/contexts/demo";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isDemo, isLoading, startDemo } = useDemo();

  async function handleTryDemo() {
    if (isDemo) {
      setLocation("/dashboard");
      return;
    }
    try {
      const { projectId } = await startDemo();
      if (projectId) {
        setLocation(`/projects/${projectId}/development`);
      } else {
        setLocation("/dashboard");
      }
    } catch {
      toast({
        title: "Demo failed",
        description: "Could not start demo mode. Please try signing up instead.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-[hsl(349_73%_44%)] selection:text-white">
      <header className="px-6 md:px-12 py-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2 text-foreground">
          <Film className="w-6 h-6 text-primary" />
          <span className="font-serif font-semibold text-lg tracking-tight">Production Pulse</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up">
            <Button className="bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] rounded-sm h-9 px-4 text-sm font-medium">
              Sign Up
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-3xl mx-auto w-full">
        <h1 className="font-serif text-5xl md:text-6xl font-medium tracking-tight text-foreground leading-[1.1] mb-6">
          The physical production folder, reimagined.
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed">
          A crisp, paper-based editorial aesthetic brought to screen.
          Production Pulse is a professional management tool for working filmmakers and students.
          Uncluttered, purposeful, and calm.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/sign-up">
            <Button className="bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] rounded-sm h-11 px-8 text-base font-medium">
              Start your project
            </Button>
          </Link>
          <Button
            variant="outline"
            className="rounded-sm h-11 px-8 text-base font-medium border-border hover:bg-secondary hover:text-foreground"
            onClick={handleTryDemo}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Try Demo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          No sign-up required. Demo mode creates a temporary workspace with sample data.
        </p>
      </main>

      <footer className="px-6 md:px-12 py-6 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Production Pulse.</span>
        <span>Crafted for filmmakers.</span>
      </footer>
    </div>
  );
}
