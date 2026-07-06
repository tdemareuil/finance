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
- Page détail d'un actif avec widget **TradingView** et historique de cours

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
| `VITE_EODHD_API_KEY` | non | Clé EODHD ; **vide = mode mock** |
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
Cliquez sur **« Explorer en mode démo »** pour un jeu de données fictif immédiat,
ou créez un compte si Supabase est configuré.

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
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, et éventuellement `VITE_EODHD_API_KEY`.
   (Optionnel : variable `VITE_DEFAULT_BENCHMARK`.)
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

## 8. Limites connues du prototype

- **Change EUR/USD fixe** : les montants USD sont convertis en EUR via un taux constant
  simplifié (`portfolioCalculator.ts`), pas de taux historique.
- **Benchmark approché** : la courbe MSCI World simule l'investissement des mêmes flux
  de trésorerie nets (dépôts/retraits) dans l'ETF, aux cours historiques.
- **Séries de valeur** : échantillonnées en fin de mois pour les graphiques.
- **Données de marché mock** : déterministes mais fictives ; branchez EODHD pour du réel.
  L'app n'est jamais bloquée si EODHD échoue (repli automatique sur le mock).
- **TradingView** nécessite une connexion internet (script externe).
- **Mode démo** : stockage local (`localStorage`) à des fins de démonstration uniquement.
  La source de vérité reste Supabase une fois configuré.
- Pas de connexion automatique aux brokers, pas de simulation « 0 frais » (hors périmètre).
- Bundle : le parsing Excel (`xlsx`/SheetJS) est chargé à la demande (chunk séparé) ;
  le reste (~250 kB gzip, Recharts) n'est pas code-splitté — acceptable pour un prototype.
- `xlsx@0.18.5` (npm) porte des advisories connues ; l'app ne parse que vos propres
  fichiers de confiance. Pour durcir, migrer vers la version CDN de SheetJS.

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
                marketDataService, portfolioCalculator, benchmarkService
  data/         mockMarketData, demoData
  utils/        format, aggregations
  types/        index.ts
supabase/       schema.sql (tables + RLS + policies)
```
