/**
 * Données de démonstration (produit fictif « Lumen Music »).
 * Chaque objet respecte contract/openapi.yaml : `npm run contract:test` le vérifie.
 * Rien ici n'est une mesure réelle.
 */
import type * as T from "@/lib/api/types";

export const PRODUCT = "lumen";
/** "22T01:42" ou "22T01:42:18" → horodatage ISO, heure de Paris. */
const D = (s: string) => `2026-10-${s}${s.split(":").length === 2 ? ":00" : ""}+02:00`;

export const runSummary: T.RunSummary = {
  product: "Lumen Music",
  servedRelease: "r-212",
  lastFactAt: D("22T01:42:04"),
  platform: { integrity: "intact", silentProbes: 1 },
  value: {
    engineerHours: { value: 86, estimated: true, period: "octobre", methodUrl: "/lumen/proofs/export#methode" },
    cvesFixed: { count: 14, medianDelaySeconds: 13200 },
    incidentsAvoided: 2,
    auditPrep: { days: 0.5, previousDeclaredDays: 12 },
    monthlyCost: { amount: null, currency: "EUR", note: "auto-hébergé" },
  },
  autonomy: {
    percent: 72,
    autonomous: 31,
    total: 43,
    windowDays: 30,
    breakdown: { autonomous: 31, withIntervention: 7, unknown: 3, notCovered: 2, outsideStandard: 8 },
  },
  guarantees: { qualifie: 9, observe: 8, propose: 3, inconnu: 4, non_couvert: 3 },
  limits: [
    { title: "Limite actuelle", reason: "Le jeton ne porte pas le tenant : l'isolation des données reste dans le produit." },
  ],
  reopenedZones: [
    { zoneId: "playlists", name: "Playlists", reason: "Nouvelle route", detail: "POST /playlists/{id}/collab · étapes 2 à 5 à refaire" },
    { zoneId: "abonnements", name: "Abonnements", reason: "Schéma modifié", detail: "Colonne trial_end · vérification relancée" },
    { zoneId: "identite", name: "Identité · Keycloak", reason: "Claim modifié", detail: "Touche 3 zones" },
  ],
};

export const components: T.Component[] = [
  {
    id: "api",
    name: "API · api.lumen.fm",
    state: "qualifie",
    stateLabel: "Autonome",
    autonomy: { autonomous: true },
    metrics: [
      { key: "rps", label: "Débit", value: 1800, unit: "req/s", display: "1,8k" },
      { key: "p95", label: "p95", value: 212, unit: "ms" },
    ],
    series: [34, 30, 32, 24, 27, 20, 23, 16, 19, 12, 15, 9, 11],
  },
  {
    id: "postgres",
    name: "Postgres principal",
    state: "non_couvert",
    stateLabel: "Isolation non couverte",
    autonomy: { autonomous: false, limit: "Isolation inter-tenant", reason: "Claim tenant absent du jeton" },
    metrics: [
      { key: "qps", label: "Requêtes", value: 6200, unit: "/s", display: "6,2k" },
      { key: "lag", label: "Réplication", value: 0.4, unit: "s", display: "0,4" },
    ],
    series: [28, 26, 30, 22, 25, 24, 18, 22, 20, 24, 17, 19, 15],
  },
  {
    id: "cdn",
    name: "CDN audio",
    state: "inconnu",
    stateLabel: "Inconnu",
    autonomy: { autonomous: false, limit: "Frontière", reason: "Hors Standard, sonde silencieuse depuis 6 h" },
    metrics: [
      { key: "start", label: "Démarrage", value: null, unit: "s", display: "—" },
      { key: "capture", label: "Capture", value: null, display: "absente · 6 h" },
    ],
    series: [26, 24, 27, 22, 25, 23, 24, null, null, null, null, null, null],
  },
];

const events: T.LiveEvent[] = [
  { id: "e10", at: D("22T01:42:18"), type: "probe.result", actor: "probe", tag: "sonde", tone: "ok", summary: "Entrée internet conforme · r-212", ref: { kind: "guarantee", id: "g-ingress" } },
  { id: "e9", at: D("22T01:42:11"), type: "agent.step", actor: "agent", tag: "bac m-121", tone: "agent", summary: "Écriture de api/invites.py", ref: { kind: "mission", id: "m-121" } },
  { id: "e8", at: D("22T01:42:05"), type: "precheck.progress", actor: "platform", tag: "précontrôle", tone: "info", summary: "m-122 · tests 34/52", ref: { kind: "candidate", id: "c-493" } },
  { id: "e7", at: D("22T01:41:58"), type: "judge.verdict", actor: "kernel", tag: "juge 2", tone: "info", summary: "Rejeu de c-490 en cours", ref: { kind: "candidate", id: "c-490" } },
  { id: "e6", at: D("22T01:41:52"), type: "judge.verdict", actor: "kernel", tag: "juge 1", tone: "ok", summary: "c-490 conforme à la loi v14", ref: { kind: "candidate", id: "c-490" }, journal: { entry: 18352, hash: "2b81…c09e" } },
  { id: "e5", at: D("22T01:41:40"), type: "refusal", actor: "platform", tag: "bac m-119", tone: "bad", summary: "Sortie pypi.org refusée → leçon", ref: { kind: "trace", id: "t-pypi" } },
  { id: "e4", at: D("22T01:41:33"), type: "probe.result", actor: "probe", tag: "sonde", tone: "ok", summary: "Intégrité de la configuration conforme" },
  { id: "e3", at: D("22T01:41:20"), type: "release.progress", actor: "platform", tag: "release", tone: "info", summary: "r-213 en canary à 10 %", ref: { kind: "release", id: "r-213" } },
  { id: "e2", at: D("22T01:41:02"), type: "fact.admitted", actor: "kernel", tag: "fait", tone: "ok", summary: "j#18351 · 61e requête refusée", journal: { entry: 18351, hash: "9c40…7aa1" } },
  { id: "e1", at: D("22T01:40:47"), type: "probe.result", actor: "probe", tag: "sonde CDN", tone: "warn", summary: "Aucune réponse depuis 6 h", ref: { kind: "gap", id: "gap-cdn" } },
];

export const liveSnapshot: T.LiveSnapshot = {
  counters: { activeSandboxes: 3, externalAgents: 1, prechecks: 1, judgements: 1, probes15m: 46, probesConform: 45, factsPerHour: 212 },
  missions: [
    { id: "m-121", title: "Invitations par lien", badge: "Qwen", steps: [ { label: "politique proposée", status: "done" }, { label: "écrit api/invites.py", status: "running" }, { label: "tests", status: "pending" } ] },
    { id: "m-122", title: "CVE-2026-4127 · requests", badge: "Autonome", steps: [ { label: "correctif écrit", status: "done" }, { label: "envoyé au précontrôle", status: "handed_off" } ] },
    { id: "m-119", title: "Refactor de la recherche", badge: "Codex · externe", external: true, steps: [ { label: "sortie pypi.org refusée", status: "refused" }, { label: "leçon transmise", status: "handed_off" } ] },
  ],
  prechecks: [
    {
      missionId: "m-122",
      candidateId: "c-493",
      elapsedSeconds: 58,
      expectedSeconds: 100,
      tools: [
        { tool: "Tests", progress: 0.65, status: "running", detail: "34/52" },
        { tool: "Opengrep", progress: 1, status: "passed" },
        { tool: "OSV", progress: 1, status: "passed" },
        { tool: "Gitleaks", progress: 1, status: "passed" },
      ],
    },
  ],
  judgements: [
    { candidateId: "c-490", title: "retrait de middleware/ratelimit.py", judges: [ { name: "Juge 1", status: "conform" }, { name: "Juge 2", status: "replaying" } ] },
  ],
  release: { id: "r-213", strategy: "canary", trafficShare: 0.1, previous: "r-212", health: "healthcheck 200 · erreurs 0,02 % · p95 208 ms" },
  probes: [
    { id: "p-ingress", label: "Entrée · internet", status: "ok", lastAt: D("22T01:42:18"), guaranteeId: "g-ingress" },
    { id: "p-egress", label: "Sorties interdites", status: "ok", lastAt: D("22T01:41:50"), guaranteeId: "g-egress" },
    { id: "p-integrity", label: "Intégrité config", status: "ok", lastAt: D("22T01:40:30"), guaranteeId: "g-integrity" },
    { id: "p-rate", label: "Débit · 61e refusé", status: "ok", lastAt: D("22T01:37:30"), guaranteeId: "g-rate" },
    { id: "p-cdn", label: "CDN audio", status: "silent", lastAt: D("21T19:40:00"), guaranteeId: "g-playback" },
    { id: "p-tenant", label: "Inter-tenant", status: "not_covered", lastAt: null, guaranteeId: "g-tenant" },
  ],
  events,
};

/** Scénario rejoué en boucle par le flux SSE du faux backend. */
export const liveScript: Omit<T.LiveEvent, "id" | "at">[] = [
  { type: "precheck.progress", actor: "platform", tag: "précontrôle", tone: "info", summary: "m-122 · tests 41/52", ref: { kind: "candidate", id: "c-493" } },
  { type: "probe.result", actor: "probe", tag: "sonde", tone: "ok", summary: "Sorties interdites refusées · 3/3" },
  { type: "agent.step", actor: "agent", tag: "bac m-121", tone: "agent", summary: "Tests de refus ajoutés (lien expiré, autre tenant)", ref: { kind: "mission", id: "m-121" } },
  { type: "judge.verdict", actor: "kernel", tag: "juge 2", tone: "ok", summary: "c-490 conforme · rejeu identique", ref: { kind: "candidate", id: "c-490" } },
  { type: "precheck.progress", actor: "platform", tag: "précontrôle", tone: "ok", summary: "m-122 · 52/52 · précontrôle passé en 1 min 38 s", ref: { kind: "candidate", id: "c-493" } },
  { type: "fact.admitted", actor: "kernel", tag: "fait", tone: "ok", summary: "Débit : 61e requête refusée sur r-212" },
  { type: "refusal", actor: "platform", tag: "politique", tone: "bad", summary: "PUT /playlists/p_4410 refusé · membre retiré", ref: { kind: "trace", id: "t-8f2c1a" } },
  { type: "release.progress", actor: "platform", tag: "release", tone: "info", summary: "r-213 en canary à 25 %", ref: { kind: "release", id: "r-213" } },
  { type: "probe.result", actor: "probe", tag: "sonde", tone: "ok", summary: "Entrée internet conforme · r-213" },
  { type: "probe.result", actor: "probe", tag: "sonde CDN", tone: "warn", summary: "Toujours silencieuse" },
];

export const traces: Record<string, T.Trace> = {
  "t-8f2c1a": {
    id: "t-8f2c1a",
    at: D("22T01:12:07"),
    request: { method: "PUT", path: "/playlists/p_4410", status: 403 },
    subject: "u_281",
    release: "r-212",
    verdict: "refused",
    hops: [
      { stage: "entry", label: "Entrée · passerelle", outcome: "ok", detail: "Session OIDC valide · budget 12 / 60 par minute · corps conforme", durationMs: 2 },
      {
        stage: "policy",
        label: "Politique · playlist.modifier",
        outcome: "refused",
        detail: "u_281 n'est ni propriétaire ni membre de p_4410. Il a été retiré des membres le 20 oct. à 18:02 par le propriétaire.",
        rule: {
          file: "policies/playlists.cedar",
          line: 4,
          version: "v4",
          source: 'permit (principal, action == Action::"playlist.modifier", resource)\nwhen { resource.owner == principal || principal in resource.members }',
          failingClause: "|| principal in resource.members",
        },
      },
      { stage: "data", label: "Données · Postgres RLS", outcome: "not_reached" },
      { stage: "egress", label: "Sortie · proxy", outcome: "not_reached" },
    ],
    cli: "entrée      ok     session, budget 12/60\npolitique   REFUS  playlist.modifier\n            u_281 retiré des membres le 20 oct.\n            policies/playlists.cedar:4 (v4)",
  },
  "t-pypi": {
    id: "t-pypi",
    at: D("22T01:41:40"),
    request: { method: "GET", path: "https://pypi.org/simple/rapidfuzz/", status: 403 },
    subject: "agent m-119",
    release: "bac",
    verdict: "refused",
    hops: [
      { stage: "sandbox", label: "Bac de l'agent", outcome: "ok", detail: "Mission m-119 · agent externe Codex" },
      { stage: "egress", label: "Sortie · proxy de l'agent", outcome: "refused", detail: "pypi.org n'est pas une destination admise pendant une mission. Les dépendances passent par le miroir épinglé." },
    ],
    cli: "bac         ok     m-119\nsortie      REFUS  pypi.org hors loi\n            utiliser le miroir épinglé",
  },
};

export const refusals: T.RefusalGroup[] = [
  { route: "PUT /playlists/…", stage: "policy", count: 7, sampleTrace: "t-8f2c1a" },
  { route: "GET /search", stage: "budget", count: 41 },
  { route: "→ api.segment.io", stage: "egress", count: 3 },
  { route: "GET /playlists/p_2/…", stage: "data", count: 1 },
];

export const decisions: T.Decision[] = [
  {
    id: "d-access-1",
    kind: "access",
    status: "auto_granted",
    title: "Session root de 15 min accordée automatiquement à ops@lumen",
    context: "Raison déclarée : disque plein sur le nœud data-2. La session est enregistrée ; toute modification hors release passera en « intégrité rompue ».",
    scope: "FLOOR-0 · aucun acteur seul",
    recommendation: { source: "Règle d'urgence R-3", text: "Signée par vous le 14 oct. Alerte disque confirmée par la télémétrie → 15 min, nœud data-2 seulement. Personne n'a été réveillé." },
    options: [ { id: "review", label: "Revoir demain matin", primary: true }, { id: "revoke", label: "Révoquer maintenant" } ],
    createdAt: D("22T01:28:00"),
    expiresAt: D("22T01:43:00"),
  },
  {
    id: "d-collab-invite",
    kind: "business",
    status: "open",
    title: "Les membres peuvent-ils inviter d'autres membres ?",
    context: "Route POST /playlists/{id}/collab apparue au commit 8d21e0f. Le code laisse tout membre inviter ; 38 invitations observées en 2 jours, toutes par des propriétaires.",
    scope: "Playlists · rouvert par une nouvelle route",
    recommendation: { source: "IA", text: "Réserver l'invitation au propriétaire : c'est l'usage réel observé." },
    options: [ { id: "owner", label: "Propriétaire seul", primary: true }, { id: "members", label: "Tous les membres" } ],
    createdAt: D("21T22:12:00"),
    links: [ { kind: "zone", id: "playlists" } ],
  },
  {
    id: "d-admin-cut",
    kind: "irreversible",
    status: "open",
    title: "Couper l'accès direct admin.lumen.internal",
    context: "3 scripts internes l'utilisent encore (export nocturne, backoffice, monitoring). L'IA a proposé leur passage par l'entrée ; 2 sur 3 sont migrés.",
    scope: "Transfert · Playlists",
    options: [ { id: "cut", label: "Couper maintenant" }, { id: "wait", label: "Attendre le 3e script", primary: true } ],
    createdAt: D("21T18:30:00"),
  },
  {
    id: "d-law-v14",
    kind: "rule",
    status: "open",
    title: "Autoriser la sortie vers api.mux.com",
    context: "Élargissement demandé par l'agent pour la zone Diffusion audio. Aucune donnée personnelle dans les appels prévus.",
    scope: "Loi d'exploitation v14 · geste signé",
    options: [ { id: "sign", label: "Signer v14", primary: true }, { id: "refuse", label: "Refuser" } ],
    createdAt: D("21T16:05:00"),
  },
  {
    id: "d-gdpr-export",
    kind: "business",
    status: "open",
    title: "Export RGPD : qui peut le lancer ?",
    context: "Aucune règle dans le code · zone en découverte",
    options: [ { id: "answer", label: "Répondre" } ],
    createdAt: D("20T10:00:00"),
  },
];

export const agentDecided: T.AgentDecidedSummary = {
  windowDays: 7,
  total: 31,
  breakdown: [
    { label: "Corrections admises", count: 23 },
    { label: "Montées de version", count: 6 },
    { label: "Retrait d'ancien code", count: 1 },
    { label: "Extracteur ajouté", count: 1 },
  ],
};

export const guarantees: T.Guarantee[] = [
  { id: "g-egress", title: "Sorties limitées à 4 destinations", path: "runtime → egress", instrument: "Sonde de refus", window: "24 h", freshness: "il y a 6 min", state: "qualifie", release: "r-212", level: "verifie" },
  { id: "g-rate", title: "Excès d'appels refusés à l'entrée", path: "internet → Envoy → api", instrument: "Sonde de charge", window: "24 h", freshness: "il y a 12 min", state: "qualifie", release: "r-212", level: "verifie" },
  { id: "g-latency", title: "p95 de PUT /playlists < 250 ms à 400 req/s", path: "Envoy → api → pg", instrument: "Métriques OTel", window: "7 j", freshness: "il y a 1 min", state: "observe", value: "212 ms", release: "r-212", level: "observe" },
  { id: "g-playback", title: "Démarrage de lecture audio < 1,5 s", path: "app → CDN audio", instrument: "Sonde utilisateur", window: "1 h", freshness: "capture absente · 6 h", stale: true, state: "inconnu", release: "r-212" },
  { id: "g-tenant", title: "Refus inter-tenant sur les playlists", path: "api → pg (RLS)", instrument: "Tenants synthétiques requis", window: "—", freshness: "—", state: "non_couvert" },
  { id: "g-ingress", title: "Aucun contournement de l'entrée", path: "3 points de sonde", instrument: "Atteignabilité", window: "24 h", freshness: "il y a 18 min", state: "non_couvert", value: "admin.lumen.internal" },
  { id: "g-restore", title: "Restauration Postgres < 30 min", path: "backup → restore", instrument: "Exercice planifié", window: "mensuel", freshness: "jamais exécuté", state: "propose" },
];

export const proofChains: Record<string, T.ProofChain> = {
  "g-playback": {
    guaranteeId: "g-playback",
    title: "Démarrage de lecture audio < 1,5 s",
    links: [
      { stage: "resource", label: "CDN audio · r-212", status: "ok" },
      { stage: "probe", label: "probe-eu-west", status: "ok" },
      { stage: "capture", label: "Absente depuis 6 h", status: "broken" },
      { stage: "instrument", label: "En attente", status: "pending" },
      { stage: "observation", label: "—", status: "pending" },
      { stage: "fact", label: "—", status: "pending" },
      { stage: "guarantee", label: "Inconnue", status: "unknown" },
    ],
    lastQualified: { value: "1,21 s", at: D("20T21:40:00"), release: "r-211", reused: false },
  },
};

export const gaps: T.Gap[] = [
  { id: "gap-tenant", title: "Claim tenant absent du jeton", guarantee: "Isolation inter-tenant", displayedAs: "non_couvert", owner: "standard", nextStep: "Émettre le claim, puis tenants synthétiques", scope: "platform" },
  { id: "gap-admin", title: "admin.lumen.internal hors de l'entrée", guarantee: "Aucun contournement", displayedAs: "non_couvert", owner: "client", nextStep: "Décision en attente", scope: "product", decisionId: "d-admin-cut" },
  { id: "gap-cdn", title: "Sonde CDN silencieuse", guarantee: "Démarrage de lecture", displayedAs: "inconnu", owner: "client", nextStep: "Rétablir la sonde", scope: "product" },
  { id: "gap-restore", title: "Restauration jamais exercée", guarantee: "Reprise après sinistre", displayedAs: "inconnu", owner: "standard", nextStep: "Exercice planifié le 28 oct.", scope: "platform" },
  { id: "gap-payment", title: "Paiement en découverte", guarantee: "Un seul paiement par abonnement", displayedAs: "non_couvert", owner: "client", nextStep: "Figer la zone Paiement", scope: "product" },
  { id: "gap-root", title: "Root du cloud client", guarantee: "Intégrité de la plateforme", displayedAs: "detecte", owner: "assumed", nextStep: "Informatique confidentielle · feuille de route", scope: "platform" },
  { id: "gap-judges", title: "Juges dans le même processus", guarantee: "Intégrité des preuves", displayedAs: "limite_plateforme", owner: "standard", nextStep: "Séparer les deux juges", scope: "platform" },
  { id: "gap-reports", title: "Rapport de tests falsifiable", guarantee: "Qualification par tests", displayedAs: "limite_plateforme", owner: "standard", nextStep: "Instrument indépendant seul", scope: "platform" },
  { id: "gap-js", title: "Analyse JavaScript lexicale", guarantee: "Scanners front", displayedAs: "partiel", owner: "standard", nextStep: "Analyse par AST", scope: "platform" },
];

export const frontiers: T.Frontier[] = [
  { name: "CDN audio", note: "surveillé" },
  { name: "Stripe", note: "sortie surveillée" },
  { name: "Application mobile", note: "non gérée" },
  { name: "Contrôles organisationnels ISO", note: "au client" },
];

export const timeline: T.TimelineEntry[] = [
  { id: "tl1", at: D("22T01:31:00"), actor: "probe", title: "Garantie « démarrage de lecture » passée à inconnu", detail: "Sonde CDN silencieuse depuis 6 h. Dernière valeur qualifiée conservée pour r-211.", journal: { entry: 18342, hash: "9f3a…c21e" }, refs: [ { kind: "guarantee", id: "g-playback" } ] },
  { id: "tl2", at: D("22T01:28:00"), actor: "human", title: "Accès d'urgence accordé par la règle R-3", detail: "15 min sur data-2 · à revoir demain matin.", journal: { entry: 18339, hash: "4b70…a9d2" }, refs: [ { kind: "decision", id: "d-access-1" } ] },
  { id: "tl3", at: D("21T22:10:00"), actor: "change", title: "Zone Playlists rouverte", detail: "Nouvelle route POST /playlists/{id}/collab au commit 8d21e0f. Étapes 2 à 5 à refaire ; les décisions précédentes restent valides.", journal: { entry: 18301, hash: "e1c8…07bb" }, refs: [ { kind: "zone", id: "playlists" } ] },
  { id: "tl4", at: D("21T04:31:00"), actor: "kernel", title: "Candidat c-482 admis", detail: "Deux juges · tests 48/48 · scanners 0 · programmes épinglés. Fusion sur main.", badge: "Admis", journal: { entry: 18277, hash: "77d0…3f15" }, refs: [ { kind: "mission", id: "m-117" } ] },
  { id: "tl5", at: D("21T03:52:00"), actor: "agent", title: "Leçon : sortie vers api.segment.io refusée", detail: "Refus du bac transmis à l'agent, qui a retiré l'appel de télémétrie.", journal: { entry: 18269, hash: "0aa1…d4c7" } },
  { id: "tl6", at: D("21T03:40:00"), actor: "human", title: "Décision : les membres peuvent modifier une playlist collaborative", detail: "Geste signé · politique Playlists v3 → v4 · fondé sur 1 204 requêtes observées.", journal: { entry: 18264, hash: "c3a9…5e60" } },
  { id: "tl7", at: D("20T04:00:00"), actor: "kernel", title: "Bascule observée : limite d'appels publics", detail: "24 h · 412/412 excès refusés · 0 faux refus · 3 points d'observation.", journal: { entry: 18112, hash: "5d2f…b880" } },
];

export const journalIntegrity: T.JournalIntegrity = {
  chained: true,
  replayMatches: true,
  entries: 18352,
  lastAnchor: { at: D("22T01:30:00"), entry: 18340 },
};

export const compliance: Record<string, T.ComplianceReport> = {
  iso27001: {
    framework: "iso27001",
    title: "ISO 27001 · annexe A",
    totalControls: 93,
    counts: { verifie: 14, observe: 9, lu: 22, inconnu: 4, non_couvert: 13, hors_standard: 31 },
    controls: [
      { id: "A.8.8", title: "Vulnérabilités techniques", evidence: "CVE détectées, corrigées, release et délai · SBOM et VEX par release", levels: ["verifie"] },
      { id: "A.8.32", title: "Gestion des changements", evidence: "Chaque release : proposition, précontrôles, jugement, décision humaine si requise", levels: ["verifie"] },
      { id: "A.8.15", title: "Journalisation", evidence: "Journal chaîné, rejoué, ancré", levels: ["verifie"] },
      { id: "A.8.20", title: "Sécurité des réseaux", evidence: "Sondes d'atteignabilité et de sorties · zone Playlists", levels: ["verifie", "observe"] },
      { id: "A.5.15", title: "Contrôle d'accès", evidence: "Politique Cedar en application, refus mesurés", levels: ["observe"] },
      { id: "A.8.28", title: "Codage sécurisé", evidence: "Scanners sur chaque commit, règles ASVS appliquées", levels: ["lu"] },
      { id: "A.8.13", title: "Sauvegarde", evidence: "Restauration jamais exercée", levels: ["inconnu"] },
      { id: "A.8.3", title: "Restriction d'accès à l'information", evidence: "Isolation inter-tenant non prouvée · claim tenant absent", levels: ["non_couvert"] },
      { id: "A.6", title: "Contrôles liés aux personnes", evidence: "Organisationnel · à prouver par le client", levels: ["hors_standard"] },
    ],
    lastSnapshot: { at: D("22T01:50:00"), release: "r-212", sha256: "7c1e…a04f" },
  },
  dora: {
    framework: "dora",
    title: "DORA",
    totalControls: 28,
    counts: { verifie: 6, observe: 5, lu: 6, inconnu: 3, non_couvert: 4, hors_standard: 4 },
    controls: [
      { id: "Art. 12", title: "Sauvegarde et restauration", evidence: "Restauration jamais exercée", levels: ["inconnu"] },
      { id: "Art. 17", title: "Gestion des incidents TIC", evidence: "Chronologie reconstituée depuis le journal", levels: ["verifie"] },
      { id: "Art. 19", title: "Notification des incidents majeurs", evidence: "Modèle pré-rempli depuis le journal", levels: ["observe"] },
      { id: "Art. 24", title: "Tests de résilience", evidence: "Sondes, scanners, exercices datés et signés", levels: ["verifie", "lu"] },
      { id: "Art. 28", title: "Risque lié aux tiers", evidence: "Registre d'information : partie technique seulement", levels: ["lu", "hors_standard"] },
    ],
    lastSnapshot: null,
  },
  nis2: {
    framework: "nis2",
    title: "NIS2 · article 21",
    totalControls: 10,
    counts: { verifie: 3, observe: 2, lu: 2, inconnu: 1, non_couvert: 1, hors_standard: 1 },
    controls: [
      { id: "21.2.d", title: "Sécurité de la chaîne d'approvisionnement", evidence: "SBOM, GuardDog, OSV par release", levels: ["verifie"] },
      { id: "21.2.e", title: "Sécurité du développement", evidence: "Précontrôles et jugement sur chaque candidat", levels: ["verifie"] },
      { id: "21.2.c", title: "Continuité d'activité", evidence: "Restauration jamais exercée", levels: ["inconnu"] },
    ],
    lastSnapshot: null,
  },
};

export const exportsList: T.ExportJob[] = [
  { id: "x-0412", format: "audit_bundle", status: "ready", createdAt: D("22T01:50:00"), release: "r-212", url: "/exports/x-0412.zip", sha256: "7c1e…a04f", includesGaps: true },
];

export const missions: T.MissionDetail[] = [
  {
    id: "m-121",
    title: "Invitations par lien",
    kind: "feature",
    status: "awaiting_decision",
    zoneId: "playlists",
    branch: "mission/m-121",
    model: "Qwen 72B auto-hébergé",
    startedAt: D("22T01:20:00"),
    costEur: 0.84,
    agentMinutes: 19,
    candidateId: "c-491",
    messages: [
      { id: "mm1", role: "human", at: D("22T01:20:00"), text: "Ajoute des invitations par lien aux playlists collaboratives. Le lien expire au bout de 7 jours." },
      { id: "mm2", role: "agent", at: D("22T01:21:00"), text: "J'ai lu la zone Playlists et sa politique. Je propose une opération playlist.inviter_par_lien réservée au propriétaire, comme l'usage observé ; un lien signé, à usage unique, valable 7 jours ; 4 scénarios de refus : lien expiré, déjà utilisé, autre tenant, playlist archivée.", question: "Un membre invité par lien peut-il inviter à son tour ?" },
      { id: "mm3", role: "human", at: D("22T01:23:00"), text: "Non, seulement le propriétaire." },
      { id: "mm4", role: "agent", at: D("22T01:39:00"), text: "Noté et signé dans la politique. J'ai codé, testé et vérifié dans le bac. 12 scénarios sur 13 passent ; le refus entre tenants reste non couvert tant que le jeton ne porte pas le tenant. Je peux livrer derrière un drapeau, ou attendre ce correctif.", actions: [ { id: "ship-flag", label: "Livrer derrière un drapeau", primary: true }, { id: "wait-tenant", label: "Attendre le claim tenant" }, { id: "why", label: "Pourquoi ?" } ] },
    ],
    plan: [
      { key: "spec", label: "Spec", status: "done", detail: "3 règles, 4 refus attendus · rédigée avec un modèle frontier (autorisé par Lumen)" },
      { key: "impact", label: "Impact sur la zone", status: "done", detail: "1 opération ajoutée · 1 table · aucune sortie réseau nouvelle" },
      { key: "policy", label: "Politique Cedar", status: "done", detail: "1 permission ajoutée", code: '+ permit (principal, action == Action::"playlist.inviter_par_lien", resource)\n+ when { resource.owner == principal };' },
      { key: "code", label: "Code", status: "done", detail: "Candidat c-491 · +118 −6 · relu par 2 relecteurs · précontrôle 1 min 38 s", link: { kind: "candidate", id: "c-491" } },
      { key: "proof", label: "Preuves", status: "warning", detail: "12 / 13 scénarios · inter-tenant non couvert", link: { kind: "zone", id: "playlists" } },
      { key: "release", label: "Release", status: "pending", detail: "En attente de votre choix" },
    ],
    context: {
      zone: "Playlists v4 · 5 opérations",
      rules: "14 règles ASVS (contrôle d'accès, validation, journalisation)",
      blocks: ["access", "render"],
      files: ["api/playlists.py", "api/invites.py", "tests/test_invites.py"],
      testExpectations: "Un succès et un refus par opération, refus inter-tenant, budget",
      capabilities: "Écriture : api/, tests/ · pas de réseau · aucun secret",
    },
  },
  {
    id: "m-117",
    title: "Décision de politique sur PUT /playlists/{id}",
    kind: "bugfix",
    status: "admitted",
    zoneId: "playlists",
    branch: "mission/m-117",
    model: "Qwen 72B auto-hébergé",
    startedAt: D("21T03:10:00"),
    costEur: 0.41,
    agentMinutes: 11,
    candidateId: "c-487",
    messages: [],
    plan: [
      { key: "code", label: "Code", status: "done", detail: "Candidat c-487 · +42 −9" },
      { key: "proof", label: "Preuves", status: "done", detail: "52 / 52 tests · 0 alerte" },
      { key: "release", label: "Release", status: "done", detail: "r-212" },
    ],
    context: {
      zone: "Playlists v4 · 5 opérations · décision du 21 oct. incluse",
      rules: "14 règles ASVS (contrôle d'accès, validation, journalisation)",
      blocks: ["access", "render", "front"],
      files: ["api/playlists.py", "db/scope.py", "tests/test_playlists.py"],
      testExpectations: "Un succès et un refus par opération, refus inter-tenant, budget",
      capabilities: "Écriture : api/, tests/ · pas de réseau · aucun secret",
    },
  },
];

const ctx = (files: string[]): T.MissionDetail["context"] => ({
  zone: "Playlists v4 · 5 opérations",
  rules: "14 règles ASVS (contrôle d'accès, validation, journalisation)",
  blocks: ["access"],
  files,
  testExpectations: "Comportement inchangé, refus conservés",
  capabilities: "Écriture limitée aux fichiers listés · pas de réseau · aucun secret",
});
missions.push(
  {
    id: "m-122",
    title: "CVE-2026-4127 · requests",
    kind: "cve",
    status: "running",
    zoneId: "playlists",
    branch: "mission/m-122",
    model: "Qwen 72B auto-hébergé",
    startedAt: D("22T01:38:00"),
    candidateId: "c-493",
    messages: [{ id: "mm1", role: "agent", at: D("22T01:39:00"), text: "requests 2.31.0 est vulnérable (CVE-2026-4127). Montée en 2.32.4, aucun changement d'API utilisé par Lumen. Envoyé au précontrôle." }],
    plan: [
      { key: "code", label: "Correctif", status: "done", detail: "requirements.txt · +1 −1" },
      { key: "proof", label: "Précontrôle", status: "running", detail: "Tests en cours", link: { kind: "candidate", id: "c-493" } },
      { key: "release", label: "Release", status: "pending", detail: "Autonome : aucune décision humaine requise pour cette classe" },
    ],
    context: ctx(["requirements.txt"]),
  },
  {
    id: "m-119",
    title: "Refactor de la recherche",
    kind: "feature",
    status: "running",
    zoneId: "playlists",
    branch: "mission/m-119",
    model: "Codex · agent externe",
    external: true,
    startedAt: D("22T01:05:00"),
    messages: [{ id: "mm1", role: "agent", at: D("22T01:41:40"), text: "Ma requête vers pypi.org a été refusée par le bac. J'utilise le miroir épinglé pour rapidfuzz." }],
    plan: [
      { key: "code", label: "Code", status: "running", detail: "Même bac, mêmes murs qu'un agent interne" },
      { key: "proof", label: "Preuves", status: "pending", detail: "Après le précontrôle" },
    ],
    context: ctx(["search/index.py", "search/query.py"]),
  },
  {
    id: "m-120",
    title: "Retrait de middleware/ratelimit.py",
    kind: "removal",
    status: "admitted",
    zoneId: "playlists",
    branch: "mission/m-120",
    model: "Qwen 72B auto-hébergé",
    startedAt: D("21T05:00:00"),
    candidateId: "c-490",
    messages: [],
    plan: [
      { key: "proof", label: "Bascule observée", status: "done", detail: "24 h · 412/412 excès refusés par l'entrée · 0 faux refus" },
      { key: "code", label: "Retrait", status: "done", detail: "Candidat c-490 · −84 lignes", link: { kind: "candidate", id: "c-490" } },
      { key: "release", label: "Jugement", status: "running", detail: "Juge 2 en rejeu" },
    ],
    context: ctx(["middleware/ratelimit.py", "app.py"]),
  },
);

export const candidates: Record<string, T.Candidate> = {
  "c-487": {
    id: "c-487",
    missionId: "m-117",
    additions: 42,
    deletions: 9,
    files: ["api/playlists.py", "tests/test_playlists.py", "policies/playlists.cedar"],
    diff: '@@ api/playlists.py · L84\n @router.put("/playlists/{playlist_id}")\n-async def update(playlist_id: str, body: PlaylistIn):\n+async def update(playlist_id: str, body: PlaylistIn,\n+                 subject: Subject = Depends(standard.subject)):\n     playlist = await repo.get(playlist_id)\n+    standard.decide("playlist.modifier", subject, playlist)\n     return await repo.update(playlist, body)',
    reviews: [
      { reviewer: "Relecteur A", verdict: "conform", note: "Décision placée là où l'objet est chargé. Règle métier respectée." },
      { reviewer: "Relecteur B", verdict: "corrected", note: "Manquait un refus pour un membre retiré. Test ajouté au draft suivant." },
    ],
    prechecks: [
      { tool: "Tests", status: "passed", detail: "52 / 52" },
      { tool: "Opengrep · Ruff S", status: "passed", detail: "0" },
      { tool: "OSV-Scanner · GuardDog", status: "passed", detail: "0" },
      { tool: "Gitleaks", status: "passed", detail: "0" },
      { tool: "Mur du bac", status: "refused", detail: "1 refus" },
    ],
    precheckSeconds: 102,
    lessons: ["Sortie vers api.segment.io refusée : destination absente de la loi. L'agent a retiré l'appel de télémétrie."],
  },
};
candidates["c-490"] = {
  id: "c-490",
  missionId: "m-120",
  additions: 0,
  deletions: 84,
  files: ["middleware/ratelimit.py", "app.py"],
  diff: "@@ app.py · L12\n-from middleware.ratelimit import RateLimiter\n-app.add_middleware(RateLimiter, per_minute=60)\n@@ middleware/ratelimit.py\n-# fichier supprimé (82 lignes) : la limite est appliquée par l'entrée Envoy",
  reviews: [
    { reviewer: "Relecteur A", verdict: "conform", note: "Aucun autre appelant. La limite est prouvée à l'entrée depuis 24 h." },
    { reviewer: "Relecteur B", verdict: "conform", note: "Le test de rafale passe toujours : 429 à la 61e requête." },
  ],
  prechecks: [
    { tool: "Tests", status: "passed", detail: "52 / 52" },
    { tool: "Opengrep · Ruff S", status: "passed", detail: "0" },
    { tool: "Gitleaks", status: "passed", detail: "0" },
  ],
  precheckSeconds: 71,
  lessons: [],
};
candidates["c-493"] = {
  id: "c-493",
  missionId: "m-122",
  additions: 1,
  deletions: 1,
  files: ["requirements.txt"],
  diff: "@@ requirements.txt\n-requests==2.31.0\n+requests==2.32.4",
  reviews: [{ reviewer: "Relecteur A", verdict: "conform", note: "Montée de correctif, pas d'API dépréciée utilisée." }],
  prechecks: [
    { tool: "Tests", status: "passed", detail: "en cours" },
    { tool: "OSV-Scanner · GuardDog", status: "passed", detail: "0" },
    { tool: "Gitleaks", status: "passed", detail: "0" },
  ],
  precheckSeconds: 58,
  lessons: [],
};
candidates["c-491"] = { ...candidates["c-487"], id: "c-491", missionId: "m-121", additions: 118, deletions: 6, files: ["api/invites.py", "tests/test_invites.py", "policies/playlists.cedar"], precheckSeconds: 98, lessons: [] };

export const agentMetrics: T.AgentMetrics = {
  windowDays: 30,
  missions: 184,
  admitted: 171,
  rollbacks: 0,
  firstPassRate: 0.78,
  firstPassDelta: 0.09,
  reworkAvg: 1.4,
  costPerChangeEur: 0.62,
  medianLeadTimeSeconds: 7800,
  sandboxRefusalsPerMission: [3.1, 2.8, 2.9, 2.4, 2.1, 1.8, 1.6, 1.3, 1.1, 0.9, 0.7],
};

export const autonomyLadder: T.AutonomyClass[] = [
  { id: "cve", label: "CVE de dépendances", tier: 4, evidence: "41 admises · 0 rollback", next: "Autonome" },
  { id: "minor", label: "Montées de version mineures", tier: 4, evidence: "63 admises · 0 rollback", next: "Autonome" },
  { id: "bugfix", label: "Corrections de bug", tier: 3, evidence: "22 / 30 au 1er passage", next: "encore 8 admissions sans reprise" },
  { id: "removal", label: "Retrait d'ancien code", tier: 3, evidence: "4 retraits · refus démontrés", next: "10 retraits requis" },
  { id: "feature", label: "Nouvelles fonctionnalités", tier: 2, evidence: "6 livrées · 3 décisions métier", next: "les décisions métier restent humaines" },
  { id: "policy", label: "Règles et politiques", tier: 2, evidence: "propositions seulement", next: "Toujours signé par un humain", alwaysHuman: true },
];

export const modelRoutes: T.ModelRoute[] = [
  { task: "Lecture du code, correctifs", share: "92 % des appels", model: "Qwen 72B · chez Lumen", location: "self_hosted" },
  { task: "Spec et tâches difficiles", share: "8 % · autorisé par Lumen", model: "Modèle frontier", location: "frontier" },
  { task: "Agents externes", share: "même bac, mêmes murs", model: "Claude Code · Codex", location: "external_agent" },
];

export const zones: T.Zone[] = [
  { id: "playlists", name: "Playlists", status: "transferring", statusLabel: "Figé v4", step: 6, policyVersion: "v4" },
  { id: "diffusion", name: "Diffusion audio", status: "discovery", statusLabel: "Découverte", step: 1 },
  { id: "abonnements", name: "Abonnements", status: "discovery", statusLabel: "Découverte", step: 2 },
  { id: "paiement", name: "Paiement", status: "discovery", statusLabel: "Découverte", step: 1 },
  { id: "rgpd", name: "Export RGPD", status: "not_started", statusLabel: "À venir", step: 0 },
];

export const sharedDependencies: T.SharedDependency[] = [
  { id: "keycloak", name: "Identité · Keycloak", openIssues: 2, severity: "warn" },
  { id: "network", name: "Réseau · plateforme", openIssues: 0, severity: "ok" },
  { id: "postgres", name: "Postgres principal", openIssues: 1, severity: "bad" },
];

export const inventory: T.Inventory = {
  zoneId: "playlists",
  commit: "4f2a91c",
  counts: { concordant: 28, aiOnly: 6, unsupported: 3, outsideCode: 2, dormant: 3 },
  items: [
    { id: "i1", resource: "PUT /playlists/{id}", kind: "Route FastAPI", sources: { extractor: "yes", ai: "yes", real: "yes" }, evidence: { path: "api/playlists.py", line: 88, commit: "4f2a91c" }, state: "observe", stateLabel: "Observé" },
    { id: "i2", resource: "/admin/labels/*", kind: "Routes via register_admin()", sources: { extractor: "no", ai: "yes", real: "yes" }, evidence: { path: "admin/registry.py", line: 31, commit: "4f2a91c" }, state: "propose", stateLabel: "Extracteur proposé" },
    {
      id: "i3",
      resource: "POST /hooks/label-sync",
      kind: "Webhook partenaire",
      sources: { extractor: "no", ai: "warn", real: "no" },
      evidence: { text: "citation introuvable", warn: true },
      state: "non_etaye",
      stateLabel: "Non étayé",
      unsupported: {
        reasoning: "L'IA le déduit d'un README et d'un appel sortant qui envoie une URL de callback au partenaire.",
        failure: "extrait introuvable à integrations/labels.py:118",
        risk: "entrée",
      },
    },
    { id: "i4", resource: "admin.lumen.internal", kind: "Hôte joignable sans l'entrée", sources: { extractor: "no", ai: "no", real: "yes" }, evidence: { text: "Journaux du load balancer" }, state: "non_couvert", stateLabel: "Non couvert" },
    { id: "i5", resource: "s3://lumen-exports", kind: "Bucket nommé dans une variable", sources: { extractor: "no", ai: "yes", real: "yes" }, evidence: { path: "exports/settings.py", line: 14, commit: "4f2a91c" }, state: "observe", stateLabel: "Observé" },
    { id: "i6", resource: "GET /v1/legacy/charts", kind: "Route déclarée", sources: { extractor: "yes", ai: "yes", real: "no" }, evidence: { path: "api/legacy.py", line: 7, commit: "4f2a91c" }, state: "inconnu", stateLabel: "Dormant" },
    { id: "i7", resource: "@require_license", kind: "Décorateur maison · contrôle de licence", sources: { extractor: "no", ai: "yes", real: "yes" }, evidence: { path: "rights/decorators.py", line: 22, commit: "4f2a91c" }, state: "observe", stateLabel: "Contrôle trouvé" },
  ],
  aiExtractors: [
    {
      candidateId: "c-481",
      pattern: "register_admin(app, path, handler)",
      code: 'def extract(tree):\n    for call in calls(tree, "register_admin"):\n        yield Route("/admin" + arg(call, 1),\n                    source=call.loc)',
      status: "admitted",
      found: 4,
    },
  ],
};

export const dossier: T.Dossier = {
  zoneId: "playlists",
  commit: "4f2a91c",
  resources: [
    { id: "r1", name: "api.lumen.fm", detail: "deploy/envoy.yaml", state: "qualifie", stateLabel: "Qualifié" },
    { id: "r2", name: "PUT /playlists/{id}", detail: "api/playlists.py:88", mono: true, state: "observe", stateLabel: "Observé" },
    { id: "r3", name: "GET /stream/{track}", detail: "CDN hors runtime", mono: true, state: "inconnu", stateLabel: "Inconnu" },
    { id: "r4", name: "admin.lumen.internal", detail: "Contourne l'entrée", mono: true, state: "non_couvert", stateLabel: "Non couvert" },
    { id: "r5", name: "Keycloak · realm lumen", detail: "Claim tenant absent", state: "inconnu", stateLabel: "Inconnu" },
    { id: "r6", name: "Postgres · playlists", detail: "db/scope.py", state: "propose", stateLabel: "Suggestion" },
    { id: "r7", name: "api.stripe.com", detail: "Sortie paiement", mono: true, state: "observe", stateLabel: "Observé" },
  ],
  operations: [
    { id: "o1", name: "playlist.lire", rule: "Propriétaire, ou membre si partagée", state: "qualifie", stateLabel: "Confirmée" },
    { id: "o2", name: "playlist.modifier", rule: "Propriétaire ou membre — décision du 21 oct.", state: "qualifie", stateLabel: "Confirmée" },
    { id: "o3", name: "playlist.inviter", rule: "Qui peut inviter ? — rouvert par une nouvelle route", state: "inconnu", stateLabel: "Écart" },
    { id: "o4", name: "titre.lire", rule: "Abonnement × territoire × licence", state: "qualifie", stateLabel: "Confirmée" },
    { id: "o5", name: "paiement.déclencher", rule: "Un seul par abonnement", state: "propose", stateLabel: "Proposée" },
    { id: "o6", name: "export.utilisateur", rule: "Qui peut le lancer ?", state: "inconnu", stateLabel: "Inconnue" },
  ],
  links: [ { resourceId: "r2", operationId: "o2" } ],
  businessQuestions: [
    { title: "Les membres peuvent-ils inviter d'autres membres ?", detail: "38 invitations observées, toutes par des propriétaires", decisionId: "d-collab-invite" },
    { title: "Webhook label-sync : réel ?", detail: "Non étayé · risque entrée" },
    { title: "Export RGPD : qui peut le lancer ?", detail: "Aucune règle dans le code", decisionId: "d-gdpr-export" },
  ],
  securityRequests: [
    { title: "Fermer admin.lumen.internal", severity: "blocking" },
    { title: "Claim tenant dans le jeton", severity: "open" },
    { title: "Rétablir la sonde CDN", severity: "open" },
    { title: "Rotation de STRIPE_KEY", severity: "open" },
  ],
};

const f = (value: string, gap = false, source?: string) => ({ value, gap, ...(source ? { source } : {}) });

export const policy: T.Policy = {
  zoneId: "playlists",
  file: "policies/playlists.cedar",
  version: "v4",
  mode: "observation",
  source:
    '// policies/playlists.cedar · généré par l\'IA, revu comme du code\npermit (principal, action == Action::"playlist.modifier", resource)\nwhen { resource.owner == principal || principal in resource.members }\nunless { resource.archived };',
  operations: [
    { name: "playlist.lire", actor: f("Propriétaire ou membre", false, "code"), object: f("Une playlist"), precondition: f("Partagée ou à soi"), budget: f("600 / min", false, "trafic"), channel: f("API publique") },
    { name: "playlist.modifier", actor: f("Membres aussi ?", true), object: f("Sa playlist"), precondition: f("Non archivée"), budget: f("60 / min", false, "trafic"), channel: f("API publique") },
    { name: "playlist.partager", actor: f("Propriétaire"), object: f("Sa playlist"), precondition: f("Publique ?", true), budget: f("20 / jour"), channel: f("API publique") },
    { name: "playlist.supprimer", actor: f("Propriétaire"), object: f("Sa playlist"), precondition: f("—"), budget: f("Aucune trace", true), channel: f("API publique") },
    { name: "playlist.importer", actor: f("Worker import"), object: f("Playlist créée"), precondition: f("Fichier validé"), budget: f("5 / heure"), channel: f("File ou API ?", true) },
  ],
  readiness: { defaultsFilled: 34, defaultsTotal: 38, gapsResolved: 0, gapsTotal: 4, quietHoursRequired: 48, quietHoursReached: false },
};

export const shadowRefusals: T.ShadowRefusals = {
  windowDays: 7,
  total: 1231,
  requests: 2400000,
  primaryLabel: "Membres de playlist collaborative",
  perDay: [
    { date: "2026-10-14", primary: 168, others: 9 },
    { date: "2026-10-15", primary: 176, others: 9 },
    { date: "2026-10-16", primary: 184, others: 12 },
    { date: "2026-10-17", primary: 180, others: 8 },
    { date: "2026-10-18", primary: 172, others: 8 },
    { date: "2026-10-19", primary: 174, others: 8 },
    { date: "2026-10-20", primary: 182, others: 8 },
  ],
  top: [
    { route: "PUT /playlists/{id}", count: 1204, note: "Membres d'une playlist collaborative qui ajoutent des titres", options: [ { id: "allow", label: "Autoriser les membres", primary: true }, { id: "keep", label: "Garder refusé" } ] },
    { route: "POST /playlists/{id}/share", count: 19, note: "Partage public depuis l'app mobile v4.2" },
    { route: "DELETE /playlists/{id}", count: 8, note: "Rafales au-delà du budget par défaut" },
  ],
};

export const verification: T.VerificationRun = {
  zoneId: "playlists",
  candidateId: "c-487",
  scenarios: [
    { title: "Le propriétaire modifie sa playlist", expected: "Succès", result: "200", outcome: "passed" },
    { title: "Un membre modifie une playlist collaborative", expected: "Succès · décision du 21 oct.", result: "200", outcome: "passed" },
    { title: "Un membre retiré tente une modification", expected: "Refus", result: "403", outcome: "passed" },
    { title: "Lecture d'une playlist d'un autre tenant", expected: "Refus", result: "—", outcome: "not_covered", outcomeLabel: "Non couvert · claim tenant" },
    { title: "Sortie vers une destination non admise", expected: "Refus", result: "bloqué", outcome: "passed" },
    { title: "Rafale au-delà du budget (60/min)", expected: "Refus après 60", result: "429 à 61", outcome: "passed" },
    { title: "Panne de la passerelle pendant une écriture", expected: "Fermé → 503, pas d'écriture", result: "503", outcome: "passed" },
    { title: "Reprise après redémarrage", expected: "État cohérent", result: "ok", outcome: "passed" },
    { title: "Fuzzing du schéma OpenAPI · 1 200 cas", expected: "Aucune erreur 500", result: "2 × 500", outcome: "failed", outcomeLabel: "Renvoyé à l'agent" },
    { title: "Répétition d'un paiement", expected: "Un seul effet", result: "—", outcome: "out_of_scope", outcomeLabel: "Paiement en découverte" },
  ],
  scanners: [
    { tool: "Opengrep · Ruff S", reason: "code Python", activated: true },
    { tool: "OSV-Scanner · GuardDog", reason: "requirements.txt", activated: true },
    { tool: "Trivy · Hadolint", reason: "Dockerfile", activated: true },
    { tool: "Schemathesis", reason: "schéma OpenAPI", activated: true },
    { tool: "ZAP · Nuclei", reason: "route publique", activated: true },
    { tool: "eslint-plugin-security", reason: "pas de front dans cette zone", activated: false },
  ],
  catalog: { rules: 156, framework: "ASVS 5.0" },
  failures: [
    { summary: "PUT /playlists/{id} renvoie 500 si title dépasse 255 caractères.", lesson: "Valider la longueur, renvoyer 422.", missionId: "m-117" },
  ],
};

export const transfers: T.Transfer[] = [
  {
    id: "tr-rate",
    control: "Limite d'appels publics",
    location: "middleware/ratelimit.py:12",
    target: "Entrée Envoy",
    targetDetail: "Route par route · 60 req/min/utilisateur",
    stepsDone: 4,
    blockedAt: null,
    status: "Bascule observée · 24 h · 0 faux refus",
    decision: "removal_in_progress",
    decisionLabel: "Retrait en cours",
    stepLabels: ["Effet compris", "Envoy installé", "Comparé · 412/412 excès refusés", "Bascule observée · 24 h", "Ancien code retiré · c-490"],
    proof: { points: ["Internet · eu-west", "VPC app", "VPC data"], statement: "Aucun contournement observé depuis ces 3 points, du 20 oct. 04:00 au 21 oct. 04:00, release r-212." },
    removal: { file: "middleware/ratelimit.py", candidateId: "c-490" },
  },
  { id: "tr-egress", control: "Sorties vers l'inconnu", location: "http/client.py:40", target: "Propriétaire des sorties", targetDetail: "4 destinations admises", stepsDone: 3, blockedAt: null, status: "5/5 succès · 3/3 refus", decision: "ready_to_switch", decisionLabel: "Basculer" },
  { id: "tr-tenant", control: "Vérification de tenant", location: "db/scope.py:27", target: "Postgres RLS", targetDetail: "gap/postgres-tenant-claim", stepsDone: 1, blockedAt: 2, status: "Jeton sans tenant", decision: "stays_in_product", decisionLabel: "Reste au produit" },
  { id: "tr-license", control: "Droit de lecture d'un titre", location: "rights/decorators.py:22", target: "Règle métier", targetDetail: "Non déplaçable", stepsDone: 0, blockedAt: null, status: "Déclarée et vérifiée", decision: "business_rule", decisionLabel: "Sur place" },
  { id: "tr-secret", control: "Secret Stripe", location: "billing/settings.py:9", target: "Courtier OpenBao", targetDetail: "Rotation à définir", stepsDone: 1, blockedAt: null, status: "Propriétaire manquant", decision: "waiting", decisionLabel: "En attente" },
];

export const failModes: T.FailMode[] = [
  { route: "PUT /playlists/{id}", mode: "closed" },
  { route: "GET /playlists/{id}", mode: "open" },
];
