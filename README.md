# CashView

**Your money, your file, your rules.**

A privacy-first personal finance tracker that runs entirely in your browser. No servers, no subscriptions, no data harvesting. Just a `.cvw` file (SQLite) that lives on your device and optionally syncs to your own Google Drive.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Why CashView?

Most personal finance apps lock your data behind their proprietary format or a monthly paywall. CashView takes a different approach:

- **Your data is a plain SQLite file** (`.cvw`). Open it with any SQLite tool. Move it anywhere. Own it forever.
- **Zero server dependency.** The database runs in your browser via [sql.js](https://github.com/sql-js/sql.js) (WASM). Nothing leaves your device unless you choose to back it up.
- **Works offline.** Full PWA support — install it on your phone or desktop and use it without internet.
- **Google Drive backup is optional.** Connect your Google account only if you want a cloud copy. The app only touches files it creates — no reading your email, contacts, or anything else.

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Visual overview with pie charts (expenses by category) and bar charts (income vs. expenses over time). |
| **Quick add** | Log income or expenses in seconds with auto-categorization. |
| **Full CRUD** | Create, edit, and delete transactions. Filter by date range (this month, last 30 days, custom). |
| **Customizable catalog** | Add/edit/delete your own categories, subcategories, and payment accounts. Budgets per category. |
| **Multi-currency** | USD, EUR, PEN, GBP, JPY, and more. Currency settings travel with your `.cvw` file. |
| **Import / Export** | Move your data between devices by exporting/importing `.cvw` files. |
| **File System Access** | On Chrome/Edge, open a `.cvw` file directly and it auto-saves after every change. |
| **Google Drive sync** | Optional: save and load your `.cvw` backup to/from your own Google Drive (OAuth 2.0, `drive.file` scope). |
| **Dark mode** | System-aware dark theme with a polished UI. |
| **PWA** | Installable on mobile and desktop. Works offline out of the box. |

---

## Tech Stack

```
Next.js 16 (App Router)  ·  React 19  ·  Tailwind CSS v4
sql.js (SQLite WASM)     ·  Recharts  ·  jose (JWT)
Google Sheets API v4     ·  Google Drive API  ·  Google OAuth 2.0
IndexedDB + OPFS         ·  File System Access API
```

The `.cvw` file **is** a SQLite database. On first load, CashView seeds it with a sensible default template (categories, accounts) and persists it to IndexedDB. If your browser supports OPFS, it mirrors there too. On Chrome/Edge, you can link a real file on disk via the File System Access API for true auto-save.

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Google Cloud project (only if you want Drive backup — skip otherwise)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/cash-view.git
cd cash-view
npm install
```

### 2. Environment variables (optional — needed for Google Drive sync)

Create `.env.local`:

```bash
GOOGLE_CLIENT_ID=<your-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-oauth-client-secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=$(openssl rand -hex 32)
```

> **Don't need Drive sync?** Just skip this step. The app works fully offline without it.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Google Drive Setup (Optional)

If you want to back up your `.cvw` file to Google Drive:

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a project.
2. Enable **Google Drive API** (and Google Sheets API if you plan to extend).
3. Create **OAuth 2.0 credentials** (Web application):
   - Authorized redirect URIs:
     - Local: `http://localhost:3000/api/auth/callback`
     - Production: `https://your-domain.vercel.app/api/auth/callback`
4. Create the OAuth consent screen (External, add your email as test user).
5. Copy the Client ID and Secret into `.env.local`.

> The app requests the `drive.file` scope only — it can only access files it creates, nothing else in your Drive.

---

## Project Structure

```
cash-view/
├── public/
│   ├── wasm/               # sql.js WASM binary
│   └── sw.js               # Service worker for PWA offline
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/       # OAuth login, callback, session
│   │   │   └── drive/      # Drive save/load endpoints
│   │   ├── catalog/        # Category & account management
│   │   ├── dashboard/      # Main dashboard + transaction list
│   │   ├── layout.tsx      # Root layout, fonts, PWA meta
│   │   ├── manifest.ts     # PWA manifest
│   │   └── page.tsx        # Redirects to /dashboard
│   ├── components/
│   │   ├── dashboard-view.tsx   # Charts, quick-add, transaction list
│   │   ├── catalog-manager.tsx  # Categories & accounts CRUD
│   │   ├── file-manager.tsx     # .cvw import/export, Drive sync
│   │   ├── app-settings.tsx     # Currency & date format
│   │   ├── install-banner.tsx   # PWA install prompt
│   │   └── logo.tsx             # Brand logo component
│   └── lib/
│       ├── local-db.ts    # SQLite engine + persistence layer
│       ├── template.ts    # Default categories, accounts, schema
│       ├── settings.ts    # User preferences (stored in .cvw)
│       ├── money.ts       # Currency formatting & parsing
│       ├── format.ts      # Date range helpers
│       ├── drive.ts       # Google Drive API wrapper
│       ├── google.ts      # OAuth utilities
│       ├── session.ts     # JWT session cookies
│       ├── brand.ts       # Brand colors & name
│       └── actions.ts     # Server actions
└── package.json
```

---

## Deploy to Vercel

1. Push to GitHub.
2. Import in [vercel.com](https://vercel.com).
3. Add environment variables (same as local, with production URL).
4. Add production URL as authorized redirect URI in Google Cloud.
5. Publish the app from the OAuth consent screen if using Drive sync.

```bash
npx vercel
```

---

## The `.cvw` File Format

CashView uses a custom file extension (`.cvw`) but under the hood it's a standard SQLite database. Schema:

```sql
CREATE TABLE movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,         -- 'Ingreso' | 'Gasto'
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  descripcion TEXT,
  importe REAL NOT NULL,
  cuenta TEXT,
  estado TEXT                 -- 'Hecho' | 'Pendiente'
);

CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  presupuesto REAL
);

CREATE TABLE cuentas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo TEXT,
  saldo REAL
);

CREATE TABLE ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
```

You can open and query your `.cvw` file with any SQLite client.

---

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
```

---

## License

MIT
