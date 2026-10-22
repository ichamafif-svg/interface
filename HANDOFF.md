# Brancher la console sur Standard

Ce document est pour l'agent (ou l'équipe) qui implémente le côté serveur.
La console est finie et testée contre un faux backend. Il reste à servir le **même contrat** depuis Standard.

## 1. Ce qui fait foi

- **`contract/openapi.yaml`** (OpenAPI 3.1, JSON Schema 2020-12). C'est la seule interface. Si Standard a besoin d'un changement, on change le contrat d'abord, puis `npm run contract:types`, puis le faux backend, puis les écrans. Jamais l'inverse.
- **`lib/mock/handler.ts`** est une implémentation de référence exécutable : comportement attendu de chaque route, statuts, erreurs.
- **`lib/mock/fixtures.ts`** montre des valeurs réalistes pour chaque champ.

## 2. Ce que la console attend du serveur

| Sujet | Attendu |
|---|---|
| Base | `STANDARD_API_URL` = URL avec le préfixe de version, ex. `https://standard.example.com/api/v1` |
| Session | Cookie `standard_session` (posé par oauth2-proxy + Keycloak devant Standard). La console relaie tous les cookies, côté serveur et via son proxy `/api/v1`. Pas d'écran de login dans la console. |
| Erreurs | RFC 9457, `application/problem+json`, `{title, status, detail?, trace?}`. Un 404 affiche la page « Rien ici ». Un autre statut affiche l'erreur telle quelle. |
| Horodatages | ISO 8601 avec fuseau. Affichage en Europe/Paris. |
| Direct | `text/event-stream`. Un `LiveEvent` JSON par message, `event:` = `LiveEvent.type`, `id:` = `LiveEvent.id`. Le proxy de la console relaie le flux sans le bufferiser. Envoyer un commentaire `: ping` toutes les 15 s derrière un load balancer. |
| Gestes signés | Voir §4. Sans signature valide : `401` Problem. |
| États | Ne jamais remplir un trou avec une valeur favorable : `inconnu`, `non_couvert`, `null` sont des réponses valides et attendues. |

## 3. Correspondance endpoints → composants Standard

| Endpoints | Source dans Standard |
|---|---|
| `topology` | Carte de la release servie : nœuds = ressources et composants (plateforme Standard / produit / hors Standard), arêtes = chemins observés (Envoy, OTel, proxy de sortie, connexions Postgres), et pour chaque garantie ce qu'elle protège (`protects`) et ce qui est exposé si elle tombe (`ifBroken`, `severity`). Les ids de nœuds/arêtes sont repris par `LiveEvent.node` / `LiveEvent.edge` pour animer la carte. |
| `live/snapshot.relay` | Relation IA ↔ humain : relais ouverts (`waiting`, ce que l'agent attend d'un humain et l'inverse, `blocking` si l'agent est arrêté), relais bouclés (`recent`, avec ce qu'ils ont débloqué), actions faites seules par l'agent. Chaque geste humain doit aussi émettre un `LiveEvent` `human.gesture`, chaque question de l'agent un `agent.question`. |
| `run/summary`, `components` | Read model : agrégats sur releases, garanties, missions. `value.*` vient du calcul de valeur (estimation marquée `estimated: true`). `autonomy` : composants maintenus sans intervention / composants sous Standard, Hors Standard exclu. |
| `live/snapshot`, `live/stream` | Bus d'événements interne : orchestrateur des bacs (agent.step, refusal), runner de précontrôles, juges (judge.verdict), contrôleur de release (canary), sondes (probe.result), noyau (fact.admitted). Le snapshot = état courant, le flux = tout ce qui suit. |
| `traces/{trace}`, `refusals` | Envoy (entrée) + décisions Cedar + RLS Postgres + proxy de sortie, corrélés par l'en-tête `X-Standard-Trace` / trace OTel. `rule.source` et `failingClause` viennent de l'évaluation Cedar. `cli` = sortie de `standard why`. |
| `decisions`, `decisions/{id}/resolve` | File des décisions humaines du noyau (métier, irréversible, accès FLOOR-0, règle). La résolution est un geste signé inscrit au journal ; la réponse porte l'entrée de journal. |
| `guarantees`, `guarantees/{id}/chain`, `gaps` | Read model des garanties sur la release servie. La chaîne suit ressource → sonde → capture → instrument → observation → fait → garantie. Une valeur qualifiée sur une autre release n'est **jamais** reprise (`reused: false`). |
| `timeline`, `journal/integrity`, `journal/verify` | Journal chaîné par hash et ancré. `verify` relance la vérification de chaîne et le rejeu des deux juges. |
| `compliance/{framework}`, `exports` | Projection des preuves sur ISO 27001 / DORA / NIS2 avec niveaux `verifie / observe / lu / inconnu / non_couvert / hors_standard`. Les écarts sont **toujours** inclus (`includesGaps: true`). |
| `missions`, `missions/{id}`, `messages`, `missions/{id}/stream`, `candidates/{id}` | Orchestrateur d'agents (bac gVisor/Firecracker, modèle routé), candidats, relecteurs, runner de précontrôles. Les messages humains sont des entrées ; la réponse de l'agent arrive par le flux de mission. |
| `agent/metrics`, `agent/autonomy`, `agent/models` | Statistiques des missions sur la fenêtre ; échelle d'autonomie par classe de tâches ; table de routage des modèles. |
| `zones`, `zones/{zone}/inventory`, `inventory/{item}` | Inventaire à trois sources : extracteurs déterministes, découverte IA, trafic réel. `non_etaye` = affirmation de l'IA sans extrait vérifiable, surfacée à l'humain, jamais jetée. |
| `zones/{zone}/dossier` | Carte ressources × opérations métier, questions métier ouvertes, demandes de sécurisation. |
| `zones/{zone}/policy`, `policy/shadow-refusals`, `policy/proposals` | Politique Cedar de la zone dans le dépôt, mode observation/application, refus hypothétiques mesurés en observation. Une proposition crée une décision à signer. |
| `zones/{zone}/verification` | Rejeu des scénarios dans le bac + scanners activés par la découverte. |
| `zones/{zone}/transfers`, `routes/fail-mode` | Transfert des contrôles du code vers la plateforme (Envoy, proxy de sortie, RLS, OpenBao). Le mode de panne par route est un geste signé. |
| `auth/gesture-challenge` | Défi WebAuthn lié au geste visé (`purpose`). |

## 4. Gestes signés (WebAuthn)

Flux implémenté dans `lib/gesture.ts` :

1. `POST /auth/gesture-challenge {purpose}` → `{challenge, rpId, expiresAt, allowCredentials}` (base64url).
2. `navigator.credentials.get({publicKey: {challenge, rpId, userVerification: "required", allowCredentials}})`.
3. Le geste part avec `signature: {type: "webauthn", assertion}`. `assertion` = base64url d'un JSON `{id, clientDataJSON, authenticatorData, signature, userHandle}` (chaque champ en base64url).

Le serveur vérifie l'assertion contre la clé enregistrée, que `clientDataJSON.challenge` correspond à un défi non expiré **et émis pour ce `purpose`**, puis inscrit le geste au journal.

`purpose` utilisés : `decision:{id}:{optionId}`, `fail-mode:{route}:{mode}`.

Le faux backend renvoie un `rpId` en `.invalid` : la console envoie alors `demo.<challenge>` sans solliciter de clé. **Un vrai backend ne doit jamais accepter ce format.** L'enregistrement des clés (passkeys) n'est pas dans la console : il se fait dans Keycloak.

## 5. Ordre de branchement conseillé

1. **`live/snapshot` (avec `relay`) + `live/stream`**, **`topology`** et **`traces/{trace}` + `refusals`.** C'est la preuve de valeur en démo : on voit le système travailler sur le vrai produit, et chaque refus s'explique.
2. `run/summary`, `components`, `guarantees`, `gaps`, `timeline`, `journal/*`.
3. `decisions` + `resolve` avec WebAuthn.
4. `missions`, `candidates`, `agent/*`.
5. `zones/*` (parcours de migration), puis `compliance` et `exports`.

Une route non branchée peut rester servie par Standard en `501` Problem : l'écran affiche l'erreur, rien n'est inventé.

## 6. Vérifier un backend

```bash
STANDARD_API_URL=https://standard-staging.example.com/api/v1 \
STANDARD_SESSION="standard_session=…" \
npm run contract:check -- --product lumen            # lectures seules
npm run contract:check -- --product lumen --writes   # + gestes, environnement de test uniquement
```

Le script découvre les identifiants depuis les listes (aucun id de démo requis), valide chaque réponse contre le schéma (y compris le premier événement SSE) et sort en erreur au premier écart. À mettre en CI côté Standard.

## 7. Ce que le contrat ne couvre pas encore

- Passage d'une politique en **application** : le bouton existe, désactivé tant que `readiness` n'est pas remplie, mais il n'y a pas encore d'endpoint. À ajouter comme geste signé (`PUT /zones/{zone}/policy/mode`).
- Flux de mission (`missions/{id}/stream`) : présent dans le contrat et le faux backend, pas encore affiché en direct dans l'écran Agent (la page se rafraîchit après chaque message).
- Pagination : seule `timeline` a un curseur. Les autres listes sont supposées courtes.
- Multi-produit : `{product}` est dans tous les chemins ; la console n'a pas encore de sélecteur de produit (`STANDARD_DEFAULT_PRODUCT`).
