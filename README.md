# 💰 Patrimoine — Dashboard patrimonial personnel

Prototype de suivi de portefeuille d'investissement (comptes **CTO**, **PEA**, **Livret+**)
sans connexion directe aux brokers (Trade Republic, Fortuneo…). Les données sont saisies
manuellement ou importées via CSV, et stockées dans **Supabase** (source de vérité,
accessible depuis plusieurs appareils).

> ⚠️ **Prototype.** Aucune donnée réelle ni clé API n'est présente dans le dépôt.
> L'application fonctionne immédiatement en **mode démo** (données fictives locales), et
> bascule sur Supabase + EODHD dès que les variables d'environnement sont renseignées.

## Stack

- **React 18 + TypeScript + Vite**
- **Supabase** (Auth + PostgreSQL avec Row Level Security)
- **Recharts** pour les graphiques internes
- **TradingView Widget** pour les graphiques détaillés d'actifs
- **EODHD** pour les données de marché (cours, historiques, dividendes) — avec repli mock
- **GitHub Pages** pour le déploiement

## Fonctionnalités

- Authentification email/mot de passe (Supabase), sessions persistantes, routes protégées
- CRUD complet : comptes, actifs, transactions
- Import CSV générique : mapping des colonnes, aperçu, détection d'erreurs et de doublons,
  création automatique des comptes/actifs manquants, `ImportBatch`
- Import **Fortuneo** (.xls « portefeuille détaillé ») : reconnu automatiquement, chaque
  position devient un achat au **PRU réel** (calculé depuis valorisation − plus-value ÷ quantité)
- Calcul des positions : quantité, **PRU** (prix de revient moyen pondéré), coût d'acquisition,
  plus-values latente et réalisée, dividendes, frais
- Performance globale et annualisée, comparaison avec un benchmark **MSCI World**
- Dashboard synthétique, évolution du patrimoine, allocations (compte / type / devise / secteur / pays)
- Dividendes reçus par mois et par actif, rendement sur coût, calendrier des dividendes
- Frais cumulés et frais par compte
- **Intérêts Livret+ calculés automatiquement** (règle française des quinzaines, capitalisation
  au 31/12) à partir d'un taux annuel configurable par compte
- Page détail d'un actif en **onglets** (Résumé, Performance, Analyse, Transactions, Dividendes)
  avec widget **TradingView** et historique de cours
- Onglet **Analyse** (via **Finnhub**) : consensus analystes, objectifs de cours, tendance des
  recommandations, actualités récentes, fondamentaux clés — avec repli mock

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
   [`supabase/schema.sql`](supabase/schema.sql) et exécutez-le.
   Cela crée les tables, les index, active **Row Level Security** et crée les
   policies (chaque utilisateur ne voit/écrit que ses propres lignes).
   - Si vous aviez déjà appliqué le schéma **avant** l'ajout de la section Analyse,
     exécutez aussi [`supabase/migration_finnhub_symbol.sql`](supabase/migration_finnhub_symbol.sql)
     (`alter table assets add column if not exists finnhub_symbol text;`).
   - Pour l'auto-calcul des intérêts Livret+, exécutez également
     [`supabase/migration_account_interest_rate.sql`](supabase/migration_account_interest_rate.sql)
     (`alter table accounts add column if not exists interest_rate numeric;`).
4. Dans *Authentication → Providers*, laissez **Email** activé.
   Pour tester rapidement, vous pouvez désactiver la confirmation email
   (*Authentication → Sign In / Providers → Confirm email*).

## 3. Variables d'environnement

Copiez `.env.example` en `.env.local` et remplissez les valeurs :

```bash
cp .env.example .env.local
```

| Variable | Obligatoire | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | pour la persistance | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | pour la persistance | Clé **Publishable** (`sb_publishable_…`) |
| `VITE_EODHD_API_KEY` | non | Clé EODHD (cours) ; **vide = mode mock** |
| `VITE_FINNHUB_API_KEY` | non | Clé Finnhub (analyse) ; **vide = mode mock** |
| `VITE_FMP_API_KEY` | non | Clé Financial Modeling Prep (**fallback** marché + analyse) ; vide = FMP désactivé |
| `VITE_DEFAULT_BENCHMARK` | non | Symbole benchmark (défaut `CW8.PA`) |
| `VITE_BASE` | non | Base URL du build (défaut `/patrimoine-dashboard/`) |

> 🔒 `.env.local` est ignoré par git. **Aucune clé ne doit être committée.**
> Sans Supabase configuré, seul le mode démo est disponible.
> Sans clé EODHD, les données de marché sont générées localement (mock déterministe).

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
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, et éventuellement `VITE_EODHD_API_KEY`
   et `VITE_FINNHUB_API_KEY`. (Optionnel : variable `VITE_DEFAULT_BENCHMARK`.)
3. Poussez sur `main`. `VITE_BASE` est renseigné automatiquement avec `/<nom-du-repo>/`.

> Le routing utilise `HashRouter` (`/#/dashboard`) : aucune configuration serveur SPA
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

Un fichier d'exemple est téléchargeable directement depuis la page **Import CSV**.

### Import Fortuneo (.xls)

Depuis Fortuneo, exportez votre **« portefeuille détaillé »** (fichier `.xls`), puis
déposez-le sur la page **Import CSV** (format *Fortuneo* ou *Auto-détection*). L'app :

- reconnaît l'en-tête `Libellé … ISIN`, détecte le type de compte (PEA/CTO) et la date d'export ;
- ignore les lignes de sous-total `Solde position CPT` ;
- crée une transaction **BUY** par ligne, au **PRU exact** (recalculé, car la colonne `PM`
  de Fortuneo est arrondie à l'entier) ;
- vous laisse choisir le **compte cible** (existant ou nouveau).

> ⚠️ C'est un **instantané de positions**, pas un historique : dividendes, frais, ventes
> passées et dates d'achat réelles ne sont pas reconstitués (tous les achats sont datés du
> jour de l'export). Pour un suivi de performance fidèle dans le temps, saisissez ensuite
> les opérations réelles ou complétez via un CSV détaillé.

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
4. Renseignez le **symbole Finnhub** de chaque actif (page Actifs → champ « Symbole Finnhub »).
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

- ~60 requêtes/minute. L'app met en cache les réponses **12 h** (LocalStorage) et ne charge
  l'onglet Analyse qu'à la demande, pour limiter les appels.
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
| `marketDataService` (cours, historique, dividendes, splits) | **EODHD → FMP → Mock** |
| `analysisService` (consensus, objectifs, tendances, news, fondamentaux) | **Finnhub → FMP → Mock** |

**Financial Modeling Prep (FMP)** est un provider **secondaire** (fallback) : ajoutez
`VITE_FMP_API_KEY` (clé gratuite sur [financialmodelingprep.com](https://site.financialmodelingprep.com))
pour l'activer. Sans clé, FMP est ignoré silencieusement. FMP n'est appelé que si le provider
principal (EODHD ou Finnhub) n'a rien renvoyé de valide pour la donnée demandée.

**Capabilities** : chaque provider déclare ce qu'il sait fournir (`LATEST_PRICE`,
`HISTORICAL_PRICES`, `DIVIDENDS`, `SPLITS`, `ANALYST_CONSENSUS`, `PRICE_TARGET`,
`RECOMMENDATION_TRENDS`, `NEWS`, `FUNDAMENTALS`). Un provider n'est jamais appelé pour une
capacité qu'il ne supporte pas.

**Stratégie anti-crédits** (`apiCacheService`) :

- **Cache mémoire + LocalStorage** avec TTL par type de donnée.
- Les **résultats vides** (`EMPTY`) et les **erreurs contrôlées** (`ERROR`, ex. endpoint payant
  402/403, quota 429) sont **aussi mis en cache** — on ne redemande pas une donnée absente
  pendant le TTL (erreurs : 1 h).
- **Déduplication in-flight** : deux appels identiques simultanés partagent la même promesse
  (une seule requête réseau).
- **Rouvrir un actif ne relance aucun appel** tant que le cache est frais (clé de cache
  déterministe `provider:capability:symbole:params`).
- L'onglet **Analyse** et l'**historique** ne sont chargés qu'à l'ouverture de l'onglet concerné.

**TTL par type de donnée :**

| Donnée | TTL |
|---|---|
| Latest price | 15 min |
| Historical prices | 24 h |
| Dividends / Splits | 7 jours |
| Analyst consensus / Price target / Recommendation trends | 24 h |
| News | 6 h |
| Fundamentals | 24 h |
| Erreurs contrôlées | 1 h |

La **source réellement utilisée** est affichée discrètement (« Source : Finnhub / FMP / EODHD /
données de démonstration »). Un fallback réussi n'affiche jamais d'erreur.

## 10. Limites connues du prototype

- **Change EUR/USD fixe** : les montants USD sont convertis en EUR via un taux constant
  simplifié (`portfolioCalculator.ts`), pas de taux historique.
- **Benchmark approché** : la courbe MSCI World simule l'investissement des mêmes flux
  de trésorerie nets (dépôts/retraits) dans l'ETF, aux cours historiques.
- **Séries de valeur** : échantillonnées en fin de mois pour les graphiques.
- **Données de marché mock** : déterministes mais fictives ; branchez EODHD pour du réel.
  L'app n'est jamais bloquée si EODHD échoue (repli automatique sur le mock).
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

- **Consensus dérivé des tendances de recommandation.** `analysisService.getConsensus` réutilise
  le résultat de `getRecommendationTrends` (même clé de cache) au lieu d'un appel dédié. Ouvrir
  l'onglet Analyse coûte donc **3 appels Finnhub, pas 4** (recommandation partagée par consensus
  + trends via déduplication in-flight, + news + fondamentaux). Les providers déclarent quand
  même `ANALYST_CONSENSUS`. *Alternative :* endpoint consensus dédié (FMP en a un) — plus de
  crédits, potentiellement plus précis pour les titres où trends ≠ consensus.
- **Taux de change EUR/USD fixe** (`portfolioCalculator.DEFAULT_FX`, ~0,92). *Alternative :* taux
  temps réel / historique par date de transaction.
- **Benchmark MSCI World approché** : on rejoue les flux nets (dépôts − retraits) dans l'ETF aux
  cours historiques. *Alternative :* vraie performance time-weighted (TWR) / money-weighted (MWR).
- **Série de patrimoine échantillonnée en fin de mois** (graphiques). *Alternative :* pas quotidien.
- **Table `portfolio_snapshots` non alimentée** : les séries sont recalculées à la volée à chaque
  chargement. *Optimisation :* écrire un snapshot quotidien pour un historique fiable et rapide.
- **Import Fortuneo = instantané de positions** → un `BUY` par ligne au PRU, daté du jour de
  l'export. Pas d'historique réel (dividendes / frais / ventes / dates d'achat). *Alternative :*
  parser l'export « opérations » daté de Fortuneo.
- **Objectifs de cours** : Finnhub gratuit ne les fournit pas (capability non déclarée) ; fallback
  FMP (souvent premium → `ERROR`) puis mock. En pratique souvent en mode démo. *Alternative :* plan payant.
- **Consensus/analyse pour ETF** : souvent absent → message informatif (pas une erreur).
- **Login mono-utilisateur** : `VITE_LOGIN_EMAIL` est une variable *build-time* → embarquée dans le
  JS livré. L'email est « masqué » de l'UI mais **pas secret** (acceptable, non sensible).
- **Mode démo** : le code existe encore (`enterDemoMode`) mais est retiré de l'UI de login ;
  accessible uniquement via le flag LocalStorage `patrimoine-demo-session`.
- **Cache** : résultats valides, **vides et erreurs** mis en cache (mémoire + LocalStorage), TTL par
  type. Les résultats mock sont aussi cachés (inoffensif car déterministes).

### Intérêts Livret+ (implémenté)

- Champ **taux annuel** par compte (fraction en base : `0.03` = 3 %).
- `computeLivretInterest` (`portfolioCalculator.ts`) applique la **règle des quinzaines** :
  versement productif à la quinzaine suivante, retrait cessant à la quinzaine courante ;
  chaque quinzaine rapporte `taux/24` ; **capitalisation au 31/12** puis composition.
- Les **intérêts crédités** (années révolues) alimentent le cash ; les **intérêts courus**
  (année en cours, estimation) sont ajoutés à la valeur totale et affichés à part (Dashboard, Comptes).
- ⚠️ Avec l'auto-calcul, **ne saisissez pas** les intérêts en tant que dépôts manuels (double comptage).

### Optimisations possibles / TODO

- Taux de change réel + conversion par date.
- Benchmark TWR/MWR ; snapshots quotidiens persistés (`portfolio_snapshots`).
- **Code-splitting** : `xlsx` déjà lazy ; découper Recharts / par route (bundle ~250 kB gzip).
- Migrer `xlsx` vers la build CDN de SheetJS (advisories npm 0.18.5).
- Éventuel passage à `@tanstack/react-query` (staleTime alignés sur les TTL) si l'app grossit.
- Garder l'état de l'onglet Analyse monté (aujourd'hui remonté au changement d'onglet, mais servi
  instantanément par le cache).
- Champ `fmpSymbol` dédié sur l'`Asset` (actuellement FMP réutilise finnhub/eodhd/ticker).

## Structure du projet

```
src/
  components/   auth, layout, charts, assets, common (UI)
  context/      AuthContext, PortfolioContext
  pages/        Login, Dashboard, Accounts, Assets, Transactions,
                CsvImport, Portfolio, AssetDetail, Dividends, Settings
  services/     supabaseClient, dataMode, localStore, rowMappers,
                accountService, assetService, transactionService,
                dividendService, importBatchService, csvImportService,
                marketDataService, analysisService, apiCacheService, consensus,
                portfolioCalculator, benchmarkService
    providers/  types, eodhdProvider, finnhubProvider, fmpProvider, mockProvider
  data/         mockMarketData, mockAnalysisData, demoData
  utils/        format, aggregations
  types/        index.ts
supabase/       schema.sql (tables + RLS + policies)
```
