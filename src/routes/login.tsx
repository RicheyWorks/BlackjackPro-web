import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="felt-wash grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm space-y-5 rounded-[var(--radius-xl)] border border-border bg-felt-mid/80 p-6">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">Blackjack Pro</p>
          <h1 className="mt-1 font-display text-2xl text-ivory">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            Optional. The table plays as a guest; sign in to keep an identity on this device.
          </p>
        </div>
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
            >
              Continue with {p.label}
            </Button>
          ))
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link to="/" className="block text-center text-sm text-muted hover:text-ivory">
          Back to the table
        </Link>
      </div>
    </main>
  );
}
