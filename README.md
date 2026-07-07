# 💰 Patrimoine — Dashboard patrimonial personnel

Prototype de suivi de portefeuille d'investissement (comptes **CTO**, **PEA**, **Livret A**,
**LDDS**, **Livret+**, **PER**, **PEE**) sans connexion directe aux brokers (Trade Republic,
Fortuneo…). Les opérations de bourse sont importées via CSV, les grants RSU et versements sur
livrets/plans d'épargne se saisissent manuellement, le tout stocké dans **Supabase**
(source de vérité, accessible depuis plusieurs appareils).

> ⚠️ **Prototype.** Aucune donnée réelle ni clé API n'est présente dans le dépôt.
> L'application fonctionne immédiatement en **mode démo** (données fictives locales), et
> bascule sur Supabase + Twelve Data / FMP dès que les variables d'environnement sont renseignées.

## Stack

- **React 18 + TypeScript + Vite**
- **Supabase** (Auth + PostgreSQL avec Row Level Security)
- **Recharts** pour les graphiques internes
- **TradingView Widget** pour le graphique détaillé d'un actif (mode région, thème sombre)
- **Twelve Data** (principal) puis **FMP** pour les données de marché (cours, historiques, dividendes) — avec repli mock
- **GitHub Pages** pour le déploiement

## Fonctionnalités

- Authentification email/mot de passe (Supabase), sessions persistantes, routes protégées
- **Gestion des comptes et actifs** (CRUD, taux des livrets, symboles TradingView/Finnhub)
  regroupée dans **Paramètres** ; les opérations de bourse s'importent par CSV, les **grants RSU**
  et **versements sur livrets** se saisissent via le menu **« + »** et s'éditent/suppriment depuis
  la fiche du titre ou la gestion des comptes. La création de comptes est **anti-doublon** : un
  compte est identifié par **(type, nom)** — le nom encode la banque (« Livret A Fortuneo »), donc
  un même type dans une autre banque reste un compte distinct. Un même type + même banque est
  réutilisé (jamais dupliqué), garanti côté app **et** par un index unique en base
- Import CSV (ouvert via un bouton depuis le Portefeuille) : aperçu, détection d'erreurs et de
  doublons, création automatique des comptes/actifs manquants, `ImportBatch`
- Import **Fortuneo** : instantané `.xls` (positions → achat au **PRU réel**) **ou** historique
  `.csv` des opérations (achats/ventes/coupons/taxes, encodage Windows-1252 géré)
- Import **Trade Republic** (CSV de transactions) : reconnu automatiquement, historique réel
  (dépôts/retraits, achats/ventes, dividendes, intérêts, frais), ISIN → rapprochement d'actifs.
  Les actifs créés à l'import sont enrichis de leur **secteur et pays** (API gratuite Finnhub
  `profile2`, repli FMP ; secteurs traduits en français, pays via `Intl.DisplayNames`)
- **Thème sombre par défaut** (bascule clair/sombre dans la barre supérieure, persistée)
- Calcul des positions : quantité, **PRU** (prix de revient moyen pondéré), coût d'acquisition,
  plus-values latente et réalisée, dividendes, frais
- Performance globale et annualisée, comparaison avec un benchmark **MSCI World**
- Bascule **« Net d'impôts »** (persistée) : retranche l'impôt estimé de **toutes les valeurs de
  gains** (plus-values latente/réalisée, dividendes, performance globale/annualisée en % et perf.
  par ligne). Hypothèses fiscales : **CTO** flat tax 30 %, **PEA/PEE** régime > 5 ans → prélèvements
  sociaux 17,2 %, **PER** 30 % en sortie, **livrets exonérés (0 %)**. Plus- et moins-values se
  compensent au sein d'un même régime ; les pertes ne créent pas de crédit d'impôt.
- Page unique **Portefeuille** (tableau de bord + positions fusionnés, page par défaut) : synthèse,
  évolution du patrimoine vs benchmark, liste **« Mes actifs »** (titres **et** livrets/plans
  d'épargne, dont le solde constitue l'actif) groupée au choix par **compte / type / niveau de
  risque** — les livrets se rangent sous le type **« Livrets »** et le risque **Faible** —, et
  allocations (compte / type / devise / secteur / pays) regroupées dans une seule tuile.
  Chaque ligne affiche **quantité, PRU, valeur, perf. (ou taux pour les livrets), poids et avis
  d'analystes** (mini-barre de consensus) ; les en-têtes de groupe montrent leur **part du total**.
  Les **espèces** de chaque compte-titres et les soldes d'épargne sont **éditables** (montant, et
  taux pour les livrets). Le solde espèces est **borné à 0 par compte** : importer des achats sans
  les versements correspondants (ex. historique Fortuneo) ne crée pas de solde négatif ni ne
  fausse le patrimoine total
- Carte **« Positions clôturées »** : titres entièrement vendus, avec leur **plus-value réalisée**
  et leurs dividendes perçus, lien vers la fiche conservé
- Depuis le Portefeuille : bouton **« 📥 Importer un CSV »** puis un menu **« + »** pour la saisie
  manuelle — **grant RSU** ou **versement/retrait** sur un livret ou plan d'épargne (Livret A, LDDS,
  Livret+, PER, PEE). Les achats/ventes de bourse passent uniquement par l'import CSV
- **Barre de recherche globale** (Finnhub, dans la barre supérieure) par nom / ticker / ISIN, avec
  fiche marché rapide (graphique TradingView + analyse : consensus, objectifs, news, prochains résultats)
- **RSU** : grants avec calendrier de **vesting** (cliff ou mensuel), plateforme (EquatePlus / Carta),
  suivi des actions acquises / à venir — affichés sur la fiche du titre concerné
- Dividendes reçus par mois et par actif, rendement sur coût, calendrier des dividendes
- **Intérêts des livrets calculés automatiquement** (Livret A, LDDS, Livret+ — règle française des
  quinzaines, capitalisation au 31/12) à partir d'un taux annuel configurable par compte
- Page détail d'un actif en **onglets** (Performance, Analyse, Transactions) : l'onglet
  **Performance** regroupe le graphique **TradingView** (mode région, thème sombre), les métriques
  de la ligne, le **vesting RSU** et les **dividendes** (reçus, historique du titre, à venir)
- Onglet **Analyse** (FMP → Finnhub) : **prochaine publication de résultats**, consensus analystes,
  objectifs de cours, tendance des recommandations, actualités récentes
- Messages de connexion explicites : distinguent un **serveur injoignable / bloqué** (projet Supabase
  en pause, filtrage réseau) d'un **mot de passe incorrect**

---

## 1. Installation locale

```bash
git clone <votre-repo>
cd patrimoine-dashboard
npm install
```

## 2. Création du projet Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Récupérez l'URL du projet et la clé **Publishable** (`sb_publishable_…`) dans
   *Settings → API Keys*. N'utilisez pas la legacy anon key, ni la `service_role` /
   `sb_secret` / JWT secret (jamais côté client).
3. Ouvrez *SQL Editor → New query*, collez le contenu de
   [`supabase/schema.sql`](supabase/schema.sql) et exécutez-le. **Pour une nouvelle base, c'est
   tout** : ce fichier crée toutes les tables (`accounts`, `assets`, `transactions`,
   `dividend_events`, `import_batches`, `rsu_grants`), les index, active **Row Level Security**
   et crée les policies (chaque utilisateur ne voit/écrit que ses propres lignes).
   - Les fichiers `supabase/migration_*.sql` ne servent qu'à mettre à jour une base **déjà créée
     avec une ancienne version du schéma** (pas besoin sur une base neuve) :
     [`migration_finnhub_symbol.sql`](supabase/migration_finnhub_symbol.sql) (colonne `finnhub_symbol`),
     [`migration_account_interest_rate.sql`](supabase/migration_account_interest_rate.sql) (colonne `interest_rate`),
     [`migration_transaction_external_id.sql`](supabase/migration_transaction_external_id.sql) (dédup `external_id` + index unique),
     [`migration_rsu_grants.sql`](supabase/migration_rsu_grants.sql) (table `rsu_grants` + RLS),
     [`migration_account_types.sql`](supabase/migration_account_types.sql) (types de compte Livret A / LDDS / PER / PEE),
     [`migration_accounts_unique.sql`](supabase/migration_accounts_unique.sql) (index unique anti-doublon sur `(user_id, type, nom)`),
     [`migration_asset_columns.sql`](supabase/migration_asset_columns.sql) (garantit les colonnes `sector`, `country`, `trading_view_symbol`, `finnhub_symbol` sur `assets` — nécessaire si l'import crée de nouveaux actifs enrichis).
4. Créez votre utilisateur dans *Authentication → Users → Add user* (il n'y a pas d'inscription
   en libre-service dans l'app). Laissez le provider **Email** activé ; pour tester rapidement,
   vous pouvez désactiver la confirmation email (*Authentication → Sign In / Providers → Confirm email*).

## 3. Variables d'environnement

Créez un fichier **`.env.local`** à la racine (ignoré par git) à partir du modèle ci-dessous,
puis remplissez au minimum les deux variables Supabase :

```env
# --- Supabase (obligatoire pour l'auth et la persistance) ---
# Clé "Publishable" (sb_publishable_…), JAMAIS la service_role / sb_secret / JWT secret.
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx

# --- Données de marché / analyse (optionnel : vide = données mock déterministes) ---
VITE_TWELVE_DATA_API_KEY=    # marché principal : cours + historiques (twelvedata.com)
VITE_FMP_API_KEY=            # marché (fallback) + analyse (principal) : dividendes, consensus… (financialmodelingprep.com)
VITE_FINNHUB_API_KEY=        # fallback marché + analyse : cours, consensus, news, résultats (finnhub.io)

# --- Divers (optionnel) ---
VITE_DEFAULT_BENCHMARK=CW8.PA   # benchmark MSCI World (symbole FMP)
VITE_LOGIN_EMAIL=               # si renseigné, le login ne demande que le mot de passe
# VITE_BASE=/                   # base URL du build (défaut : /<nom-du-repo>/ ; voir vite.config.ts)
```

| Variable | Obligatoire | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | oui (persistance) | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | oui (persistance) | Clé **Publishable** (`sb_publishable_…`) |
| `VITE_TWELVE_DATA_API_KEY` | non | Clé Twelve Data (**marché principal** : cours + historiques) ; vide = repli FMP |
| `VITE_FMP_API_KEY` | non | Clé Financial Modeling Prep (**marché fallback + analyse principale**) ; **vide = mode mock** |
| `VITE_FINNHUB_API_KEY` | non | Clé Finnhub (**fallback marché + analyse**) ; vide = repli mock |
| `VITE_DEFAULT_BENCHMARK` | non | Symbole benchmark (défaut `CW8.PA`) |
| `VITE_LOGIN_EMAIL` | non | Email pré-rempli (login mono-utilisateur : seul le mot de passe est demandé) |
| `VITE_BASE` | non | Base URL du build (défaut `/<nom-du-repo>/`) |

> 🔒 `.env.local` est ignoré par git. **Aucune clé ne doit être committée.**
> Sans Supabase configuré, seul le mode démo local est disponible.
> Sans clé de marché/analyse, les données correspondantes sont générées localement (mock déterministe).

## 4. Lancement local

```bash
npm run dev
```

L'application démarre sur `http://localhost:5173`.
Connectez-vous avec votre email / mot de passe Supabase. En mode mono-utilisateur
(`VITE_LOGIN_EMAIL` renseigné), seul le mot de passe est demandé (email pré-rempli).
Les comptes se créent côté Supabase (dashboard *Authentication → Users*) : il n'y a plus
d'inscription ni de mode démo dans l'interface de connexion.

## 5. Build

```bash
npm run build      # tsc + vite build → dossier dist/
npm run preview    # sert le build localement
```

## 6. Déploiement GitHub Pages

Deux options :

### Automatique (recommandé) — GitHub Actions

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) build et
déploie à chaque push sur `main`.

1. Dans *Settings → Pages*, choisissez **Source: GitHub Actions**.
2. Dans *Settings → Secrets and variables → Actions*, ajoutez les secrets
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, et éventuellement `VITE_TWELVE_DATA_API_KEY`,
   `VITE_FMP_API_KEY` et `VITE_FINNHUB_API_KEY`. (Optionnel : variable `VITE_DEFAULT_BENCHMARK`.)
3. Poussez sur `main`. `VITE_BASE` est renseigné automatiquement avec `/<nom-du-repo>/`.

> Le routing utilise `HashRouter` (`/#/portfolio`) : aucune configuration serveur SPA
> n'est nécessaire, et le rafraîchissement de page fonctionne sur GitHub Pages.

### Manuel

```bash
VITE_BASE=/<nom-du-repo>/ npm run build
npx gh-pages -d dist        # ou poussez dist/ sur la branche gh-pages
```

Pensez à ajuster `homepage` dans `package.json` (remplacez `USERNAME`).

## 7. Format CSV générique attendu

Colonnes reconnues (le mapping est ajustable dans l'interface) :

```
date, account, type, assetName, ticker, isin, quantity, price, fees, amount, currency, note
```

- **Obligatoires** : `date`, `account`, `type`.
- **Types acceptés** : `BUY`, `SELL`, `DIVIDEND`, `FEE`, `DEPOSIT`, `WITHDRAWAL`
  et leurs équivalents français (`achat`, `vente`, `dividende`, `frais`, `dépôt`, `retrait`).
- **Dates** : `AAAA-MM-JJ` ou `JJ/MM/AAAA`.
- **Nombres** : point ou virgule décimale acceptés.

Exemple :

```csv
date,account,type,assetName,ticker,isin,quantity,price,fees,amount,currency,note
2024-01-15,CTO Trade Republic,BUY,Apple Inc.,AAPL,US0378331005,5,185.30,1,,USD,Achat AAPL
2024-02-01,PEA Fortuneo,dépôt,,,,,,,1000,EUR,Versement
2024-03-10,CTO Trade Republic,dividende,Apple Inc.,AAPL,,,,,2.5,USD,Dividende
```

> L'import s'ouvre via le bouton **📥 Importer un CSV** sur la page Portefeuille. Les formats
> **Fortuneo** et **Trade Republic** sont reconnus automatiquement (mapping des colonnes non requis).

### Import Fortuneo (.xls)

Depuis Fortuneo, exportez votre **« portefeuille détaillé »** (fichier `.xls`), puis
déposez-le sur la page **Import CSV** (le format est reconnu automatiquement). L'app :

- reconnaît l'en-tête `Libellé … ISIN`, détecte le type de compte (PEA/CTO) et la date d'export ;
- ignore les lignes de sous-total `Solde position CPT` ;
- crée une transaction **BUY** par ligne, au **PRU exact** (recalculé, car la colonne `PM`
  de Fortuneo est arrondie à l'entier) ;
- vous laisse choisir le **compte cible** (existant ou nouveau).

> ⚠️ C'est un **instantané de positions**, pas un historique : dividendes, frais, ventes
> passées et dates d'achat réelles ne sont pas reconstitués (tous les achats sont datés du
> jour de l'export). Pour un suivi de performance fidèle dans le temps, saisissez ensuite
> les opérations réelles ou complétez via un CSV détaillé.

### Import Trade Republic (CSV)

Depuis Trade Republic, exportez l'historique de transactions (« Exportation de transactions »,
fichier `.csv`) et déposez-le (le format est reconnu automatiquement). Contrairement à
Fortuneo, c'est un **historique d'opérations** → il reconstitue fidèlement l'activité :

- `TRANSFER_*_INBOUND` / `REFERRAL` / `INTEREST` → dépôts ; `*_OUTBOUND` → retraits ;
- `BUY` / `SELL` (colonne `shares`/`price`, `fee`) → achats/ventes ;
- `DIVIDEND` → dividendes.
- La colonne `symbol` contient l'**ISIN**. Le vrai **ticker** et le symbole Finnhub sont
  **résolus automatiquement** depuis l'ISIN via Finnhub (repli FMP) — aucun ticker inventé ;
  s'il est introuvable, le ticker reste vide.

Vous choisissez le **compte cible** (par défaut « CTO Trade Republic »).

### Import Fortuneo — historique des opérations (CSV)

En plus de l'instantané `.xls`, Fortuneo fournit un **« historique des opérations bourse »**
au format `.csv` (séparateur `;`, encodage Windows-1252, en-têtes français). L'app le reconnaît
automatiquement, gère l'encodage, et en tire un **historique réel** :

- `Achat Comptant` → achat, `Vente Comptant` → vente (frais depuis `Courtage/Prélèvement`) ;
- `Encaissement Coupons` → dividende ; `Taxe` / `TTF` / droits → frais.
- Ce format **ne contient pas d'ISIN** : les actifs sont rapprochés par **nom** (le même nom
  que celui extrait de l'instantané `.xls`).

> ⚠️ N'importez pas **à la fois** l'instantané `.xls` et l'historique `.csv` dans le même
> compte : les positions seraient comptées deux fois. Préférez l'**historique** pour un suivi
> fidèle (dates, frais, dividendes réels).

## 8. Données d'analyse (Finnhub)

L'onglet **Analyse** de la page détail d'un actif utilise [Finnhub](https://finnhub.io)
via `src/services/analysisService.ts` (strictement séparé de `marketDataService`, qui ne
gère que cours / historiques / dividendes / splits).

1. Créez un compte gratuit sur [finnhub.io](https://finnhub.io/register).
2. Récupérez votre **API key** dans le dashboard Finnhub.
3. Ajoutez-la dans `.env.local` :
   ```env
   VITE_FINNHUB_API_KEY=votre_cle_finnhub
   ```
   La clé n'est **jamais** committée (`.env.local` est gitignoré). Sans clé, la section
   Analyse fonctionne avec des **données mock** (un bandeau l'indique).
4. Renseignez le **symbole Finnhub** de chaque actif (Paramètres → Actifs → champ « Symbole Finnhub »).
   À défaut, le service utilise le `ticker`.

**Exemples de symboles Finnhub :**

| Actif | Symbole Finnhub |
|---|---|
| Apple (US) | `AAPL` |
| Microsoft (US) | `MSFT` |
| LVMH (Euronext Paris) | `MC.PA` |
| ASML (Euronext Amsterdam) | `ASML.AS` |
| SAP (Xetra) | `SAP.DE` |

> Le format des marchés hors-US est `TICKER.SUFFIXE` (`.PA` Paris, `.AS` Amsterdam,
> `.DE` Xetra, `.L` Londres…).

**Limites du plan gratuit Finnhub :**

- ~60 requêtes/minute. L'app met en cache les réponses **24 h** (LocalStorage) et ne charge
  l'onglet Analyse qu'à son ouverture, pour limiter les appels.
- L'endpoint **objectifs de cours** (`price-target`) est souvent réservé au plan payant :
  il peut renvoyer vide, ce qui n'est pas traité comme une erreur.
- Les données analystes peuvent être **absentes** pour certains titres, notamment les **ETF**
  et les **petites capitalisations**. Pour un ETF, un message informatif est affiché (pas une erreur).

> ⚠️ Données informatives uniquement, ne constituent pas un conseil financier.

## 9. Providers de données & cache (fallback FMP)

L'app utilise une architecture **multi-provider**. Les composants React n'appellent jamais
une API directement : ils passent par `marketDataService` / `analysisService`, qui orchestrent
les providers via `fetchWithFallback` (`src/services/apiCacheService.ts`).

**Ordre de fallback** (on s'arrête dès qu'un provider renvoie une donnée valide) :

| Service | Ordre des providers |
|---|---|
| `marketDataService` (cours, historique, dividendes, splits) | **Twelve Data → FMP → Finnhub** |
| `analysisService` (consensus, objectifs, tendances, news, prochains résultats) | **FMP → Finnhub** |

**Twelve Data** est le provider de marché **principal** (cours + historiques) : ajoutez
`VITE_TWELVE_DATA_API_KEY` (clé gratuite sur [twelvedata.com](https://twelvedata.com)). **FMP** est le
provider de marché de **fallback** et le provider d'analyse **principal** ; **Finnhub** complète en
**fallback** (cours via `/quote`, analyse). Le service passe automatiquement au provider suivant si
la clé est absente ou si le **quota est atteint** (erreur 429 mise en cache court). Sans aucune clé,
l'app bascule sur le **mock** déterministe.

**Capabilities** : chaque provider déclare ce qu'il sait fournir (`LATEST_PRICE`,
`HISTORICAL_PRICES`, `DIVIDENDS`, `SPLITS`, `ANALYST_CONSENSUS`, `PRICE_TARGET`,
`RECOMMENDATION_TRENDS`, `NEWS`, `NEXT_EARNINGS`). Un provider n'est jamais appelé pour une
capacité qu'il ne supporte pas.

**Stratégie anti-crédits** (`apiCacheService`) :

- **Cache mémoire + LocalStorage** avec TTL par type de donnée.
- Les **résultats vides** (`EMPTY`) et les **erreurs contrôlées** (`ERROR`) sont **aussi mis en
  cache**. Le TTL d'erreur dépend de la nature (#2) : **transitoire** (quota 429, 5xx, réseau)
  → **1 h** (on réessaie vite) ; **permanent** (symbole inconnu 404, endpoint payant 402/403,
  clé invalide 401, requête invalide 400/422) → **7 jours** (inutile de re-solliciter). Évite de
  retenter en boucle un symbole qui ne résout sur aucun provider.
- **Cours (`LATEST_PRICE`) selon l'ouverture des marchés (#3)** : TTL 30 min en séance, **4 h la
  nuit**, **24 h le week-end** — les prix ne bougent pas marché fermé.
- **Déduplication in-flight** : deux appels identiques simultanés partagent la même promesse.
- **Rouvrir un actif ne relance aucun appel** tant que le cache est frais (clé de cache
  déterministe `provider:capability:symbole:params`).
- **Consensus dérivé, pas re-fetché** : l'onglet Analyse calcule le consensus à partir des
  tendances de recommandation qu'il charge déjà (mêmes données que la mini-barre du portefeuille,
  cache `RECOMMENDATION_TRENDS` partagé) → aucun appel dédié au consensus.
- L'onglet **Analyse** n'est chargé qu'à son ouverture ; les dividendes au premier affichage.

**TTL par type de donnée :**

| Donnée | TTL |
|---|---|
| Latest price | 30 min (séance) · 4 h (nuit) · 24 h (week-end) |
| Historical prices | 24 h |
| Dividends / Splits | 7 jours |
| Analyst consensus / Price target / Recommendation trends | 24 h |
| News | 6 h |
| Next earnings | 24 h |
| Erreurs — transitoires / permanentes | 1 h / 7 jours |

La **source réellement utilisée** est affichée discrètement (« Source : Twelve Data / FMP /
Finnhub / données de démonstration »). Un fallback réussi n'affiche jamais d'erreur.

**Pistes d'optimisation non encore implémentées** (voir aussi l'assessment produit) :

- **Requêtes groupées (batch)** : Twelve Data (`/price?symbol=A,B,C`) et FMP (`/quote/A,B,C`)
  acceptent plusieurs symboles par appel → transformerait *N* appels de cours en **1** au
  chargement du portefeuille (le plus gros levier).
- **Mapping des symboles Euronext pour Twelve Data** : les tickers `.PA` / `.AS` sont rejetés
  (404) par Twelve Data et basculent en repli FMP ; un format adapté (`exchange`/MIC) les ferait
  résoudre sur le provider principal, sans cascade.
- **Throttle du burst de chargement** : `PortfolioContext` lance tous les cours en parallèle
  (`Promise.all`), ce qui peut dépasser la limite gratuite Twelve Data (8 req/min) et provoquer
  des 429 inutiles ; un étalement (~6 req/min) l'éviterait (largement atténué si le batch ci-dessus
  est fait).

## 10. Limites connues du prototype

- **Change EUR/USD** : conversion au **cours actuel** (récupéré via FMP, repli mock), appliqué
  uniformément — pas de taux historique par date.
- **Benchmark approché** : la courbe MSCI World simule l'investissement des mêmes flux
  de trésorerie nets (dépôts/retraits) dans l'ETF, aux cours historiques.
- **Séries de valeur** : échantillonnées en fin de mois pour les graphiques.
- **Données de marché mock** : déterministes mais fictives ; branchez FMP pour du réel.
  L'app n'est jamais bloquée si FMP échoue (repli automatique sur le mock).
- **Données d'analyse (Finnhub)** : sans clé, données mock déterministes. Les objectifs de cours
  sont souvent réservés au plan payant ; les données analystes peuvent manquer pour les ETF et
  petites capitalisations. `marketDataService` et `analysisService` restent strictement séparés.
- **Connexion** : la page de login propose uniquement l'authentification email/mot de passe
  (pas de mode démo ni de création de compte en libre-service). Créez les comptes via Supabase
  (dashboard *Authentication → Users*, ou activez l'inscription côté Supabase si souhaité).
- **TradingView** nécessite une connexion internet (script externe).
- **Mode démo** : stockage local (`localStorage`) à des fins de démonstration uniquement.
  La source de vérité reste Supabase une fois configuré.
- Pas de connexion automatique aux brokers, pas de simulation « 0 frais » (hors périmètre).
- Bundle : le parsing Excel (`xlsx`/SheetJS) est chargé à la demande (chunk séparé) ;
  le reste (~250 kB gzip, Recharts) n'est pas code-splitté — acceptable pour un prototype.
- `xlsx@0.18.5` (npm) porte des advisories connues ; l'app ne parse que vos propres
  fichiers de confiance. Pour durcir, migrer vers la version CDN de SheetJS.

## 11. Décisions de conception & optimisations possibles

Journal des choix non triviaux et des pistes d'amélioration, pour reprendre le fil plus tard.

### Décisions de conception (et alternatives)

- **Consensus dérivé des tendances de recommandation.** L'onglet Analyse **calcule** le consensus
  à partir des tendances (`RECOMMENDATION_TRENDS`) qu'il charge déjà — mêmes données que la
  mini-barre du portefeuille (cache partagé) — donc **aucun appel dédié au consensus**. La fiche
  charge ainsi 4 capacités : objectifs de cours, tendances, actualités, prochains résultats.
  (`analysisService.getConsensus` existe encore pour les mini-barres du portefeuille.)
- **Taux de change EUR/USD au cours actuel** (Twelve Data → FMP, repli sur `DEFAULT_FX` ~0,92 si
  indisponible). *Alternative :* taux historique par date de transaction.
- **Benchmark MSCI World approché** : on rejoue les flux nets (dépôts − retraits) dans l'ETF aux
  cours historiques. *Alternative :* vraie performance time-weighted (TWR) / money-weighted (MWR).
- **Série de patrimoine échantillonnée en fin de mois** (graphiques). *Alternative :* pas quotidien.
- **Table `portfolio_snapshots` non alimentée** : les séries sont recalculées à la volée à chaque
  chargement. *Optimisation :* écrire un snapshot quotidien pour un historique fiable et rapide.
- **Import Fortuneo = instantané de positions** → un `BUY` par ligne au PRU, daté du jour de
  l'export. Pas d'historique réel (dividendes / frais / ventes / dates d'achat). *Alternative :*
  parser l'export « opérations » daté de Fortuneo.
- **Résolution du ticker à l'import** : on n'invente jamais de ticker. À la création d'un actif,
  le vrai symbole est résolu depuis l'**ISIN** (puis le nom) via Finnhub `/search` → repli FMP
  (`symbolLookupService`, cache 30 j). Non trouvé ⇒ ticker vide. Le `finnhubSymbol` est aussi
  renseigné (l'onglet Analyse marche directement) ; le `tradingViewSymbol` est déduit pour les
  tickers US sans suffixe.
- **Objectifs de cours** : Finnhub gratuit ne les fournit pas (capability non déclarée) ; fallback
  FMP (souvent premium → `ERROR`) puis mock. En pratique souvent en mode démo. *Alternative :* plan payant.
- **Consensus/analyse pour ETF** : souvent absent → message informatif (pas une erreur).
- **Login mono-utilisateur** : `VITE_LOGIN_EMAIL` est une variable *build-time* → embarquée dans le
  JS livré. L'email est « masqué » de l'UI mais **pas secret** (acceptable, non sensible).
- **Mode démo** : le code existe encore (`enterDemoMode`) mais est retiré de l'UI de login ;
  accessible uniquement via le flag LocalStorage `patrimoine-demo-session`.
- **Cache** : résultats valides, **vides et erreurs** mis en cache (mémoire + LocalStorage), TTL par
  type. Les résultats mock sont aussi cachés (inoffensif car déterministes).
- **Navigation consolidée** : Dashboard et Portefeuille fusionnés en une page **Portefeuille**
  (route par défaut ; `/dashboard` redirige). Les pages autonomes Transactions / Comptes / Actifs /
  RSU ont été **supprimées** : la gestion des comptes/actifs vit dans **Paramètres** (composants
  `AccountsManager` / `AssetsManager`), et l'édition/suppression des transactions et RSU sur la
  **fiche du titre**. Un seul modèle : créer via le bouton d'ajout, consulter/éditer là où la
  donnée s'affiche.
- **Niveau de risque** : classification **heuristique** sans champ dédié (`assetRisk` dans `utils.ts`) —
  Liquidités / livrets = Faible (risque nul), ETF **et** actions = Élevé (exposition marché actions).
  *Alternative :* champ `risk` éditable en base.
- **Saisie manuelle restreinte** : le menu **« + »** ne propose que ce qui n'a pas de source CSV —
  grants **RSU** et **versements/retraits** sur livrets (Livret A, LDDS, Livret+, PER, PEE). Un
  versement crée le compte cible à la volée s'il n'existe pas encore. Les achats/ventes de bourse
  ne se saisissent plus à la main (import CSV uniquement), mais restent **éditables** depuis la
  fiche du titre (transactions issues d'un import).
- **RSU sur la fiche du titre** : plus d'onglet RSU global ; les grants (saisis via le menu « + »)
  s'affichent sur la fiche de l'action concernée (onglet Performance).
- **Recherche globale** : `instrumentSearchService` interroge Finnhub `/search` (cache mémoire 5 min) ;
  la fiche rapide réutilise le composant `AssetAnalysis` (vrai actif si en portefeuille, sinon actif
  synthétique construit depuis le résultat).
- **Graphique TradingView** : mode région (`style: 3`), thème calqué sur l'app (sombre par défaut),
  hauteur fixée (220 px) via la config du widget (`autosize` ne récupérait pas la hauteur du conteneur).

### Intérêts des livrets (implémenté)

- Champ **taux annuel** par compte (fraction en base : `0.03` = 3 %). S'applique aux types
  porteurs d'intérêts (`isInterestBearing` : **Livret A**, **LDDS**, **Livret+**).
- `computeLivretInterest` (`portfolioCalculator.ts`) applique la **règle des quinzaines** :
  versement productif à la quinzaine suivante, retrait cessant à la quinzaine courante ;
  chaque quinzaine rapporte `taux/24` ; **capitalisation au 31/12** puis composition.
- Les **intérêts crédités** (années révolues) alimentent le cash ; les **intérêts courus**
  (année en cours, estimation) sont ajoutés à la valeur totale et affichés à part (Dashboard, Comptes).
- ⚠️ Avec l'auto-calcul, **ne saisissez pas** les intérêts en tant que dépôts manuels (double comptage).

### Déduplication des imports (implémenté)

Réimporter le même fichier, ou des fichiers qui se chevauchent, **ne crée jamais de doublon** :

- **Identifiant source** (`external_id`) prioritaire : le `transaction_id` de Trade Republic est
  stocké ; deux ré-imports du même fichier sont détectés à coup sûr, et deux opérations
  distinctes mais identiques (ex : deux virements de 3 000 € le même jour) ne sont **jamais
  fusionnées** car leurs id diffèrent.
- **Sans id** (Fortuneo, générique) : repli sur une clé composite
  (date + compte + actif *par ID résolu* + type + quantité + prix + montant + frais).
- La déduplication s'exécute contre l'état **actuel** de la base à chaque import (aperçu avant
  insertion), et un index unique `(user_id, external_id)` sert de garde-fou côté base.
- Les doublons sont exclus par défaut ; l'utilisateur peut forcer leur insertion (ils sont alors
  ré-enregistrés sans `external_id` pour ne pas heurter l'unicité).

### Optimisations possibles / TODO

- Taux de change réel + conversion par date.
- Benchmark TWR/MWR ; snapshots quotidiens persistés (`portfolio_snapshots`).
- **Code-splitting** : `xlsx` déjà lazy ; découper Recharts / par route (bundle ~250 kB gzip).
- Migrer `xlsx` vers la build CDN de SheetJS (advisories npm 0.18.5).
- Éventuel passage à `@tanstack/react-query` (staleTime alignés sur les TTL) si l'app grossit.
- Garder l'état de l'onglet Analyse monté (aujourd'hui remonté au changement d'onglet, mais servi
  instantanément par le cache).
- Champ `fmpSymbol` dédié sur l'`Asset` (actuellement FMP réutilise finnhub/ticker).

## Structure du projet

Arborescence volontairement plate (**5 dossiers**). La barre latérale n'expose que
**Portefeuille · Dividendes · Paramètres** (l'import CSV s'ouvre via un bouton du Portefeuille).

```
src/
  types.ts        modèle de données (miroir du schéma Supabase)
  utils.ts        formatage, thème, risque, erreurs, agrégations (graphiques)
  data.ts         données démo + mocks (marché & analyse), déterministes
  main.tsx, App.tsx, index.css, vite-env.d.ts
  components/      (fichiers plats, sans sous-dossiers)
                   ui, charts, Layout, ProtectedRoute, GlobalSearch,
                   HoldingsGrouped, AddOperationModal, AssetAnalysis,
                   TradingViewWidget, AccountsManager, AssetsManager
  context/         AuthContext, PortfolioContext
  pages/           Login, Portfolio (défaut), AssetDetail, Dividends,
                   CsvImport, Settings
  services/        supabaseClient, dataMode, localStore, rowMappers,
                   accountService, assetService, transactionService, rsuService,
                   dividendService, importBatchService, csvImportService,
                   instrumentSearchService, symbolLookupService,
                   marketDataService, analysisService, apiCacheService, consensus,
                   portfolioCalculator, rsuCalculator, benchmarkService
    providers/     types, twelveDataProvider, finnhubProvider, fmpProvider, mockProvider
supabase/          schema.sql (tables + RLS + policies) + migrations (finnhub_symbol,
                   account_interest_rate, transaction_external_id, rsu_grants)
```

À la racine : `index.html`, `vite.config.ts`, un unique `tsconfig.json`, `package.json`,
`.github/workflows/deploy.yml` (déploiement Pages). Pas de dossier `public/` (le workflow
officiel ne lance pas Jekyll). La config du preview local (`.claude/`) n'est pas suivie par git.
