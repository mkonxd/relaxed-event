import { KeyForm } from "@/components/key-form";
import { LastUpdated } from "@/components/last-updated";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Flat dark background — comes from `body` in globals.css */}

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <h1 className="font-[var(--font-cinzel)] mb-1 text-center text-2xl font-bold tracking-wide text-gold-bright md:text-3xl">
          WoW Forever Leveling Guide
        </h1>
        <p className="mb-1 text-center text-sm text-muted-foreground">
          Enter your BattleTag to get a key bound to it.
        </p>

        <LastUpdated className="mb-6" />

        <KeyForm />

        <footer className="absolute bottom-5 text-center text-[10px] text-muted-foreground/30">
          World of Warcraft and Blizzard Entertainment are trademarks of Blizzard
          Entertainment, Inc.
        </footer>
      </main>
    </div>
  );
}
