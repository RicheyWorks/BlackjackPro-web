import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTable } from "@/store/table";
import { unlockAudio } from "@/lib/blackjack/sfx";
import { dollars } from "@/lib/utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HandRow } from "./HandRow";
import { Actions } from "./Actions";
import { Betting } from "./Betting";
import { Hud } from "./Hud";
import { SettingsPanel, StatsPanel } from "./Panels";
import { Tape } from "./Tape";
import { ShoeTray } from "./ShoeTray";
import { Button } from "@/components/ui/button";
import { formatSeated, needsRealityWarn } from "@/lib/casino/reality";

let realityWarnShown = false;

export function Table() {
  const seated = useTable((s) => s.seated);
  const openPit = useTable((s) => s.openPit);
  const mode = useTable((s) => s.mode);
  const pitBusy = useTable((s) => s.pitBusy);
  const realityCheck = useTable((s) => s.realityCheck);
  const ackReality = useTable((s) => s.ackReality);
  const sessionStartedAt = useTable((s) => s.sessionStartedAt);
  const sessionNet = useTable((s) => s.sessionNet);
  const lastRecap = useTable((s) => s.lastRecap);
  const enterPractice = useTable((s) => s.enterPractice);
  const leaveTable = useTable((s) => s.leaveTable);
  const snap = useTable((s) => s.snap);
  const theme = useTable((s) => s.theme);
  const toast = useTable((s) => s.toast);
  const soft17 = useTable((s) => s.soft17);
  const plus3Last = useTable((s) => s.plus3Last);
  const dismissToast = useTable((s) => s.dismissToast);
  const rebetDeal = useTable((s) => s.rebetDeal);
  const hit = useTable((s) => s.hit);
  const stand = useTable((s) => s.stand);
  const double = useTable((s) => s.double);
  const split = useTable((s) => s.split);
  const surrender = useTable((s) => s.surrender);
  const clearBet = useTable((s) => s.clearBet);
  const countBet = useTable((s) => s.countBet);
  const setAutoplay = useTable((s) => s.setAutoplay);
  const autoplay = useTable((s) => s.autoplay);
  const insure = useTable((s) => s.insure);
  const [settings, setSettings] = useState(false);
  const [stats, setStats] = useState(false);
  const [ageOk, setAgeOk] = useState(() => {
    try {
      return sessionStorage.getItem("blackjack-pro-age") === "1";
    } catch {
      return false;
    }
  });
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismissToast, 3200);
    return () => window.clearTimeout(t);
  }, [toast, dismissToast]);

  useEffect(() => {
    if (!seated || mode !== "pit") return;
    const tick = () => {
      if (useTable.getState().realityCheck) return;
      const st = useTable.getState();
      if (needsRealityWarn(st.sessionStartedAt, st.lastRealityAckAt)) {
        if (!realityWarnShown) {
          realityWarnShown = true;
          useTable.setState({ toast: "Five minutes until the next reality check." });
        }
      } else {
        realityWarnShown = false;
      }
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [seated, mode]);

  useEffect(() => {
    if (!seated) return;
    const onKey = (e: KeyboardEvent) => {
      if (settings || stats) return;
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (snap.phase === "INSURANCE") {
        if (k === "y" || k === "e") {
          e.preventDefault();
          insure(true);
        }
        if (k === "n") {
          e.preventDefault();
          insure(false);
        }
        return;
      }
      if (k === "enter") {
        if (snap.phase !== "BETTING") return;
        e.preventDefault();
        rebetDeal();
        return;
      }
      if (k === "h") hit();
      if (k === "s" && !e.metaKey && !e.ctrlKey) stand();
      if (k === "d") double();
      if (k === "p") split();
      if (k === "r") surrender();
      if (k === "c") countBet();
      if (k === "a") setAutoplay(!autoplay);
      if (k === "u") {
        e.preventDefault();
        leaveTable();
        return;
      }
      if (k === "escape") clearBet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seated, settings, stats, snap.phase, rebetDeal, hit, stand, double, split, surrender, clearBet, countBet, setAutoplay, autoplay, insure, leaveTable]);

  const hideHole = snap.phase === "PLAYER" || snap.phase === "INSURANCE";
  const settled = snap.phase === "BETTING" && snap.lastOutcomes.length > 0;
  const plus3Net = plus3Last ? plus3Last.returned - plus3Last.stake : 0;

  if (!seated) {
    return (
      <div className="felt-wash flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="kicker">RicheyWorks</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight text-ivory sm:text-6xl">
          Blackjack Pro
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          Six-deck shoe, 3:2 naturals, $5–$500 box, late surrender, American
          peek, even money, splits to four hands. Optional 21+3. Hi-Lo ramp,
          Illustrious 18, and a coach that can play the count for you.
        </p>
        <ul className="mt-6 grid w-full max-w-md grid-cols-2 gap-x-4 gap-y-1 text-left text-xs text-muted sm:grid-cols-3">
          <li>S17 · DAS · late surrender</li>
          <li>Peek ace / ten</li>
          <li>Even money 1:1</li>
          <li>21+3 on the deal</li>
          <li>Hi-Lo + I18</li>
          <li>Coach optional</li>
        </ul>
        {lastRecap && (
          <p className="mt-6 font-mono text-sm tabular-nums text-ivory">{lastRecap}</p>
        )}
        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="sm:flex-1"
            onClick={() => {
              unlockAudio();
              enterPractice();
            }}
          >
            Practice table
          </Button>
          {mode === "pit" && (
            <Button
              size="lg"
              variant="outline"
              className="sm:flex-1"
              disabled={pitBusy}
              onClick={() => {
                unlockAudio();
                void openPit();
              }}
            >
              Return to pit
            </Button>
          )}
        </div>
        <div className="mt-8 w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-felt-deep/50 px-4 py-4 text-left">
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-ivory/70">Pit seat</p>
          {mode === "pit" ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Your pit seat is still open. The shoe and the ledger are where
              you left them. Sit back down with Return to pit.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Signed-in play chips on a server ledger. The hole stays off the
                wire. Not a licensed casino. No real money.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm text-ivory">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ageOk}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAgeOk(on);
                    try {
                      sessionStorage.setItem("blackjack-pro-age", on ? "1" : "0");
                    } catch {
                      /* ignore */
                    }
                  }}
                />
                <span>I am 18 or older. These chips are not money.</span>
              </label>
              {isPending ? (
                <div className="mt-3 h-11 animate-pulse rounded-[var(--radius-md)] bg-fg/10" />
              ) : user ? (
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  disabled={!ageOk || pitBusy}
                  onClick={() => {
                    unlockAudio();
                    void openPit();
                  }}
                >
                  Open pit seat
                </Button>
              ) : (
                <Button asChild className="mt-3 w-full" variant="outline" disabled={!ageOk}>
                  <Link to="/login">Sign in for a pit seat</Link>
                </Button>
              )}
            </>
          )}
        </div>
        <p className="mt-6 max-w-sm font-mono text-[0.65rem] leading-relaxed tracking-wide text-muted">
          Enter deal · H hit · S stand · D double · P split · R surrender · Y/N insure · C count · A coach · U stand up
        </p>
      </div>
    );
  }

  return (
    <div className="felt-wash flex min-h-dvh flex-col">
      <Hud onOpenSettings={() => setSettings(true)} onOpenStats={() => setStats(true)} />

      {mode === "pit" && (
        <p className="px-4 text-center text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          Play chips only. Not a licensed gambling product.
        </p>
      )}
      {realityCheck && mode === "pit" && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-felt-deep/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reality-title"
        >
          <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-border bg-felt-mid p-5">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">Reality check</p>
            <h2 id="reality-title" className="mt-2 font-display text-2xl text-ivory">Still here?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Seated {sessionStartedAt ? formatSeated(Date.now() - sessionStartedAt) : "a while"}
              {" · "}
              {snap.stats.hands} hands
              {" · "}
              {sessionNet === 0 ? "even" : `${sessionNet > 0 ? "+" : ""}${dollars(sessionNet)}`}
              . Next deal is locked until you confirm. Play chips only.
            </p>
            <Button className="mt-5 w-full" autoFocus onClick={() => ackReality()}>
              Still playing
            </Button>
          </div>
        </div>
      )}

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-between gap-4 px-3 py-4 sm:px-6">
        <section className="table-rail rounded-[var(--radius-xl)] px-2 py-6 sm:px-8 sm:py-8">
          <p className="kicker mb-4 text-center">
            {mode === "pit" ? "Pit · play chips only · not licensed · " : ""}
            {soft17 ? "Dealer hits soft 17" : "Dealer stands on soft 17"}
            {autoplay ? " · Coach is playing" : ""}
          </p>
          <HandRow
            hand={snap.dealer}
            label="Dealer"
            hideHole={hideHole}
          />

          {(settled || (plus3Last && plus3Last.stake > 0)) && (
            <div className="mt-2 space-y-0.5 text-center font-mono text-sm tabular-nums text-ivory/80">
              {settled && (
                <p>
                  {snap.lastNet === 0
                    ? "Even"
                    : `${snap.lastNet > 0 ? "+" : ""}${dollars(snap.lastNet)}`}
                </p>
              )}
              {plus3Last && plus3Last.stake > 0 && (
                <p>
                  21+3 {plus3Last.label}
                  {plus3Net === 0
                    ? ""
                    : ` ${plus3Net > 0 ? "+" : ""}${dollars(plus3Net)}`}
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-end justify-center gap-4">
            {snap.hands.map((hand, i) => (
              <HandRow
                key={i}
                hand={hand}
                label={snap.hands.length > 1 ? `Hand ${i + 1}` : "You"}
                active={snap.phase === "PLAYER" && i === snap.activeIndex}
                outcome={settled ? snap.lastOutcomes[i] : undefined}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Tape />
          <ShoeTray />
          <Betting />
          <Actions />
        </section>
      </main>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full border border-border bg-felt-deep/90 px-4 py-2 text-sm text-ivory anim-rise">
          {toast}
        </div>
      )}

      <SettingsPanel open={settings} onOpenChange={setSettings} />
      <StatsPanel open={stats} onOpenChange={setStats} />
    </div>
  );
}
