# Console Standard

L'interface de Standard : **Run, À décider, Preuves, Agent**, plus le parcours d'une zone en 6 étapes.
Next.js 15 (App Router), React 19, TypeScript strict. Thème sombre « verre », repris des maquettes.

Elle se branche sur Standard par un seul contrat : [`contract/openapi.yaml`](contract/openapi.yaml).
Sans backend, elle tourne sur un faux backend en mémoire qui implémente ce contrat avec les données de démo « Lumen Music ».

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000 → /lumen/run
```

Brancher le vrai Standard :

```bash
STANDARD_API_URL=https://standard.example.com/api/v1 npm run dev
```

Vide = faux backend. Les cookies de session du navigateur sont relayés tels quels au backend.

## Écrans

| Section | Route | Écran |
|---|---|---|
| Run | `/[product]/run` | Vue d'ensemble : valeur, autonomie, garanties, composants |
| | `/[product]/run/live` | **En direct** : relais IA ↔ humain, bacs, précontrôles, juges, release, sondes, flux SSE |
| | `/[product]/run/map` | **Carte** en couches (façon réseau de neurones) : ressources, composants, chemins, effet de chaque garantie, signaux en direct |
| | `/[product]/run/traces/[trace]` | Pourquoi refusé ? : trajet de la requête, règle Cedar fautive |
| À décider | `/[product]/decisions` | Décisions humaines signées (WebAuthn), décidé par l'IA |
| Preuves | `/[product]/proofs/guarantees` | Garanties et chaîne de preuve |
| | `/[product]/proofs/gaps` | Écarts, jamais masqués |
| | `/[product]/proofs/timeline` | Chronologie du journal, intégrité de la chaîne |
| | `/[product]/proofs/export` | ISO 27001 / DORA / NIS2 gradués, exports |
| Agent | `/[product]/agent` | Construire : missions, conversation, plan |
| | `/[product]/agent/metrics` | Métriques, échelle d'autonomie, routage des modèles |
| | `/[product]/zones` | Zones et dépendances partagées |
| Zone | `/[product]/zones/[zone]/inventory` | 1 · Découvrir |
| | `…/dossier` | 2 · Comprendre |
| | `…/policy` | 3 · Zone (politique Cedar, refus hypothétiques) |
| | `…/mission` | 4 · Coder (candidat, relectures, précontrôles) |
| | `…/verification` | 5 · Vérifier |
| | `…/transfer` | 6 · Transférer (modes de panne signés) |

`/[product]/ref/[kind]/[id]` résout n'importe quel `ObjectRef` du contrat vers le bon écran.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run contract:lint` | Valide `openapi.yaml` (Redocly) |
| `npm run contract:types` | Régénère `lib/api/schema.d.ts` depuis le contrat |
| `npm run contract:test` | Chaque réponse du faux backend validée contre le contrat |
| `npm run contract:check` | La même validation contre un vrai backend (`STANDARD_API_URL`) |
| `npm run typecheck` · `lint` · `build` | Habituels |

## Architecture

```
app/                      écrans (composants serveur) + proxy /api/v1/[...path]
components/               shell, navigation, puces d'état, actions (client), En direct (SSE)
lib/api/server.ts         client typé côté serveur : vrai backend ou faux backend en mémoire
lib/api/browser.ts        client typé côté navigateur, via le proxy /api/v1
lib/gesture.ts            gestes humains signés (WebAuthn)
lib/mock/                 faux backend : fixtures + routeur conforme au contrat
contract/openapi.yaml     LE contrat
scripts/contract-*.mjs    vérification du contrat (partagée tests / vrai backend)
```

Règles de l'interface :
- La console ne décide jamais. Elle lit et transmet des gestes ; après chaque geste, la page est relue depuis le serveur.
- Tout objet affiché porte son état. Une absence de mesure s'affiche `inconnu` ou `non couvert`, jamais comme une valeur favorable.
- Une erreur du backend s'affiche comme telle, jamais comme un zéro.

Le branchement sur Standard est décrit dans [HANDOFF.md](HANDOFF.md).
