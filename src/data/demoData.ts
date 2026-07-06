import type {
  Account,
  Asset,
  DividendEvent,
  Transaction,
} from '../types'

// ---------------------------------------------------------------------------
// Jeu de données de démonstration (fictif — aucune donnée réelle).
// Utilisé en mode démo, ou via le bouton "Charger les données de démo".
// Les IDs sont stables pour garantir l'intégrité référentielle.
// ---------------------------------------------------------------------------

const now = new Date().toISOString()

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function buildDemoData(userId: string): {
  accounts: Account[]
  assets: Asset[]
  transactions: Transaction[]
  dividendEvents: DividendEvent[]
} {
  const accounts: Account[] = [
    { id: 'demo-acc-pea', userId, name: 'PEA Fortuneo', type: 'PEA', currency: 'EUR', createdAt: now },
    { id: 'demo-acc-cto', userId, name: 'CTO Trade Republic', type: 'CTO', currency: 'EUR', createdAt: now },
    { id: 'demo-acc-livret', userId, name: 'Livret+', type: 'LIVRET_PLUS', currency: 'EUR', createdAt: now },
  ]

  const assets: Asset[] = [
    {
      id: 'demo-ast-cw8', userId, name: 'Amundi MSCI World UCITS ETF', ticker: 'CW8',
      exchange: 'PA', isin: 'FR0010315770', currency: 'EUR', type: 'ETF',
      sector: 'Diversifié', country: 'Monde', tradingViewSymbol: 'EURONEXT:CW8',
      eodhdSymbol: 'CW8.PA', finnhubSymbol: 'CW8.PA', createdAt: now,
    },
    {
      id: 'demo-ast-aapl', userId, name: 'Apple Inc.', ticker: 'AAPL',
      exchange: 'NASDAQ', isin: 'US0378331005', currency: 'USD', type: 'STOCK',
      sector: 'Technologie', country: 'États-Unis', tradingViewSymbol: 'NASDAQ:AAPL',
      eodhdSymbol: 'AAPL.US', finnhubSymbol: 'AAPL', createdAt: now,
    },
    {
      id: 'demo-ast-mc', userId, name: 'LVMH', ticker: 'MC',
      exchange: 'PA', isin: 'FR0000121014', currency: 'EUR', type: 'STOCK',
      sector: 'Luxe', country: 'France', tradingViewSymbol: 'EURONEXT:MC',
      eodhdSymbol: 'MC.PA', finnhubSymbol: 'MC.PA', createdAt: now,
    },
  ]

  const transactions: Transaction[] = [
    // --- Dépôts initiaux ---
    { id: 'demo-tx-01', userId, accountId: 'demo-acc-pea', type: 'DEPOSIT', date: iso(2023, 1, 10), amount: 10000, currency: 'EUR', source: 'MANUAL', note: 'Versement initial PEA', createdAt: now },
    { id: 'demo-tx-02', userId, accountId: 'demo-acc-cto', type: 'DEPOSIT', date: iso(2023, 1, 15), amount: 6000, currency: 'EUR', source: 'MANUAL', note: 'Versement initial CTO', createdAt: now },
    { id: 'demo-tx-03', userId, accountId: 'demo-acc-livret', type: 'DEPOSIT', date: iso(2023, 2, 1), amount: 5000, currency: 'EUR', source: 'MANUAL', note: 'Épargne de précaution', createdAt: now },

    // --- Achats ETF CW8 (PEA) ---
    { id: 'demo-tx-10', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-cw8', type: 'BUY', date: iso(2023, 1, 20), quantity: 10, price: 380, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-11', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-cw8', type: 'BUY', date: iso(2023, 6, 12), quantity: 8, price: 410, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-12', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-cw8', type: 'BUY', date: iso(2024, 1, 8), quantity: 6, price: 445, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },

    // --- Achats/ventes LVMH (PEA) ---
    { id: 'demo-tx-20', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-mc', type: 'BUY', date: iso(2023, 3, 3), quantity: 3, price: 820, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-21', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-mc', type: 'SELL', date: iso(2024, 4, 18), quantity: 1, price: 780, fees: 3.9, currency: 'EUR', source: 'MANUAL', note: 'Prise de bénéfice partielle', createdAt: now },
    { id: 'demo-tx-22', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-mc', type: 'DIVIDEND', date: iso(2024, 4, 25), amount: 26, currency: 'EUR', source: 'MANUAL', note: 'Dividende LVMH', createdAt: now },

    // --- Apple (CTO, USD) ---
    { id: 'demo-tx-30', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'BUY', date: iso(2023, 2, 1), quantity: 15, price: 145, fees: 1, currency: 'USD', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-31', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'BUY', date: iso(2023, 9, 20), quantity: 10, price: 175, fees: 1, currency: 'USD', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-32', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'DIVIDEND', date: iso(2024, 2, 15), amount: 6, currency: 'USD', source: 'MANUAL', note: 'Dividende AAPL', createdAt: now },
    { id: 'demo-tx-33', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'DIVIDEND', date: iso(2024, 5, 15), amount: 6.25, currency: 'USD', source: 'MANUAL', note: 'Dividende AAPL', createdAt: now },

    // --- Frais de tenue de compte / courtage divers ---
    { id: 'demo-tx-40', userId, accountId: 'demo-acc-cto', type: 'FEE', date: iso(2023, 12, 31), amount: 12, currency: 'EUR', source: 'MANUAL', note: 'Frais de change annuels', createdAt: now },
    { id: 'demo-tx-41', userId, accountId: 'demo-acc-pea', type: 'FEE', date: iso(2024, 6, 30), amount: 8, currency: 'EUR', source: 'MANUAL', note: 'Droits de garde', createdAt: now },

    // --- Livret+ (intérêts modélisés en dépôt) ---
    { id: 'demo-tx-50', userId, accountId: 'demo-acc-livret', type: 'DEPOSIT', date: iso(2023, 12, 31), amount: 150, currency: 'EUR', source: 'MANUAL', note: 'Intérêts Livret+', createdAt: now },
  ]

  const dividendEvents: DividendEvent[] = [
    { id: 'demo-div-01', userId, assetId: 'demo-ast-mc', exDate: iso(2024, 4, 22), paymentDate: iso(2024, 4, 25), amountPerShare: 13, currency: 'EUR', createdAt: now },
    { id: 'demo-div-02', userId, assetId: 'demo-ast-aapl', exDate: iso(2024, 2, 9), paymentDate: iso(2024, 2, 15), amountPerShare: 0.24, currency: 'USD', createdAt: now },
  ]

  return { accounts, assets, transactions, dividendEvents }
}
