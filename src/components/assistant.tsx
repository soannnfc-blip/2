"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useSpeechRecognition, useSpeech } from "@/lib/use-voice";

type PendingAction = { actionLogId: string; outil: string; parametres: unknown; niveau: string };
type ChatMessage = { id: string; role: "user" | "assistant"; contenu: string; pendingActions?: PendingAction[] };
type Dashboard = {
  ca_jour: number;
  ca_semaine: number;
  ca_mois: number;
  ca_annee: number;
  evolution_ca_mois_pourcent: number | null;
  commandes_mois: number;
  panier_moyen_mois: number;
  produits_plus_vendus: { nom: string; ca: number; ventes: number }[];
  depenses_mois: number;
  marge_estimee_mois: number;
  cotisations_estimees_mois: number;
};
type Tache = { id: string; titre: string; priorite: string; dateLimite: string | null; enRetard: boolean };
type Alerte = { id: string; type: string; titre: string; message: string; niveau: string };

const OUTIL_LABELS: Record<string, string> = {
  envoyer_email: "Envoyer cet email",
  creer_evenement: "Créer ce rendez-vous",
  modifier_evenement: "Modifier ce rendez-vous",
  ajouter_vente: "Enregistrer cette vente",
  creer_facture: "Générer cette facture",
  envoyer_facture: "Envoyer cette facture",
  creer_tache: "Créer cette tâche",
  supprimer_evenement: "Supprimer définitivement",
  enregistrer_paiement: "Enregistrer ce paiement",
  annuler_facture: "Annuler cette facture",
};

function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function Assistant({
  initialDashboard,
  initialTaches,
  initialAlertes,
  googleConnected,
  shopifyConnected,
  moteurId,
  moteurLabel,
}: {
  initialDashboard: Dashboard;
  initialTaches: Tache[];
  initialAlertes: Alerte[];
  googleConnected: boolean;
  shopifyConnected: boolean;
  moteurId: "mock" | "anthropic";
  moteurLabel: string;
}) {
  const estDemo = moteurId === "mock";
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      contenu: estDemo
        ? "Bonjour. Je suis NOTEO AI, en mode démo (aucune IA payante utilisée) avec des données fictives. Essaie par exemple : \"Regarde mes mails importants\", \"Cherche Julien\", \"Quel est mon chiffre d'affaires ce mois-ci ?\" ou \"Fais une facture pour Julien Notéo d'une carte NFC à 60€\"."
        : "Bonjour. Je suis NOTEO AI. Demande-moi ce qui se passe dans ton entreprise, ou parle-moi directement.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [taches] = useState(initialTaches);
  const [alertes, setAlertes] = useState(initialAlertes);
  const [voiceMode, setVoiceMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { speak } = useSpeech();
  const { supported: micSupported, listening, start, stop } = useSpeechRecognition((transcript) => {
    setVoiceMode(true);
    void send(transcript);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/alertes");
        if (res.ok) setAlertes((await res.json()).alertes);
      } catch {
        // silencieux
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function dismissAlerte(id: string) {
    setAlertes((a) => a.filter((al) => al.id !== id));
    await fetch("/api/alertes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function refreshDashboard() {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setDashboard(await res.json());
    } catch {
      // silencieux : le dashboard précédent reste affiché
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", contenu: trimmed }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");

      setConversationId(data.conversationId);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", contenu: data.reply, pendingActions: data.pendingActions },
      ]);
      if (voiceMode) void speak(data.reply);
      await refreshDashboard();
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", contenu: `Désolé, une erreur est survenue : ${(e as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(action: PendingAction, confirmer: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/actions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionLogId: action.actionLogId, confirmer, conversationId }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m.map((msg) => ({
          ...msg,
          pendingActions: msg.pendingActions?.filter((p) => p.actionLogId !== action.actionLogId),
        })),
        { id: crypto.randomUUID(), role: "assistant", contenu: data.reply },
      ]);
      if (voiceMode) void speak(data.reply);
      await refreshDashboard();
    } finally {
      setLoading(false);
    }
  }

  const enRetard = taches.filter((t) => t.enRetard);

  return (
    <main className="flex h-dvh flex-col bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-900 px-5 pb-3 pt-4">
        <div>
          <h1 className="text-lg font-semibold text-white">NOTEO AI</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${estDemo ? "bg-sky-500" : "bg-emerald-500"}`} />
              {moteurLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${googleConnected ? "bg-emerald-500" : "bg-neutral-600"}`} />
              {googleConnected ? "Gmail/Calendar connectés" : "Mails/agenda en démo"}
            </span>
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-full px-3 py-1.5 text-xs text-neutral-400 active:bg-neutral-900"
        >
          Déconnexion
        </button>
      </header>

      {estDemo ? (
        <div className="mx-5 mt-3 rounded-xl border border-sky-900/50 bg-sky-950/20 px-4 py-2.5 text-xs text-sky-300">
          Mode démo actif — mails, ventes, factures et agenda utilisent des données fictives
          {shopifyConnected ? "" : " (y compris les ventes Shopify)"}. Aucun appel IA payant, aucun email réel envoyé.
          Ajoute <code className="text-sky-200">ANTHROPIC_API_KEY</code> dans <code className="text-sky-200">.env</code> pour activer Claude.
        </div>
      ) : (
        !googleConnected && (
          <a
            href="/api/connect/google"
            className="mx-5 mt-3 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-2.5 text-xs text-amber-300"
          >
            Connecter Gmail / Calendar / Drive →
          </a>
        )
      )}

      <section className="flex gap-3 overflow-x-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
        <StatCard label="Aujourd'hui" value={formatEUR(dashboard.ca_jour)} />
        <StatCard label="Cette semaine" value={formatEUR(dashboard.ca_semaine)} />
        <StatCard
          label="Ce mois"
          value={formatEUR(dashboard.ca_mois)}
          hint={
            dashboard.evolution_ca_mois_pourcent == null
              ? undefined
              : `${dashboard.evolution_ca_mois_pourcent >= 0 ? "+" : ""}${dashboard.evolution_ca_mois_pourcent}% vs mois dernier`
          }
        />
        <StatCard label="Commandes (mois)" value={String(dashboard.commandes_mois)} />
        <StatCard label="Panier moyen" value={formatEUR(dashboard.panier_moyen_mois)} />
        <StatCard label="Dépenses (mois)" value={formatEUR(dashboard.depenses_mois)} />
        <StatCard label="Marge estimée" value={formatEUR(dashboard.marge_estimee_mois)} />
        <StatCard label="Cotisations est." value={formatEUR(dashboard.cotisations_estimees_mois)} />
      </section>

      {alertes.length > 0 && (
        <div className="mx-5 mb-3 space-y-2">
          {alertes.map((a) => (
            <div
              key={a.id}
              className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs ${
                a.niveau === "urgent"
                  ? "border-red-900/40 bg-red-950/20 text-red-300"
                  : a.niveau === "attention"
                    ? "border-amber-900/40 bg-amber-950/20 text-amber-300"
                    : "border-neutral-800 bg-neutral-900/50 text-neutral-300"
              }`}
            >
              <div>
                <p className="font-medium">{a.titre}</p>
                <p className="mt-0.5 text-[11px] opacity-80">{a.message}</p>
              </div>
              <button onClick={() => dismissAlerte(a.id)} className="shrink-0 opacity-60 active:opacity-100">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {enRetard.length > 0 && (
        <div className="mx-5 mb-3 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-xs text-red-300">
          {enRetard.length} tâche{enRetard.length > 1 ? "s" : ""} en retard : {enRetard.map((t) => t.titre).join(", ")}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div
                className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                  m.role === "user" ? "bg-emerald-600 text-white" : "bg-neutral-900 text-neutral-100"
                }`}
              >
                {m.contenu}
              </div>
              {m.pendingActions && m.pendingActions.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.pendingActions.map((action) => (
                    <div
                      key={action.actionLogId}
                      className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3"
                    >
                      <p className="mb-2 text-xs text-neutral-400">
                        {action.niveau === "CONFIRMATION_FORTE" ? "⚠️ Action sensible — " : ""}
                        {OUTIL_LABELS[action.outil] ?? action.outil}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirm(action, true)}
                          disabled={loading}
                          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white active:scale-[0.98] disabled:opacity-50"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => handleConfirm(action, false)}
                          disabled={loading}
                          className="flex-1 rounded-lg bg-neutral-800 py-2 text-sm font-medium text-neutral-300 active:scale-[0.98] disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm text-neutral-500">…</div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setVoiceMode(false);
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-neutral-900 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écris ou parle…"
          className="min-w-0 flex-1 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-600"
        />
        {micSupported && (
          <button
            type="button"
            onClick={() => (listening ? stop() : start())}
            aria-label="Parler"
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl transition active:scale-95 ${
              listening ? "bg-red-600 animate-pulse" : "bg-emerald-500"
            }`}
          >
            🎙
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-14 shrink-0 rounded-full bg-neutral-800 px-5 text-sm font-medium text-white disabled:opacity-40"
        >
          Envoyer
        </button>
      </form>
    </main>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-[130px] shrink-0 rounded-2xl border border-neutral-900 bg-neutral-900/50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}
