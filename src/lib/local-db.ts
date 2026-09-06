// ============================================================
// Capa de datos 100% local (Fase 1 y 2).
//
// El archivo .cvw ES una base SQLite. El motor sql.js se carga en
// tiempo de ejecución con un <script> clásico desde /wasm para no
// meter emscripten en el bundle de la app.
//
// Persistencia: IndexedDB (universal) + espejo OPFS donde exista.
// Archivo real (Fase 2): File System Access API en Chrome/Edge con
// autoguardado tras cada cambio.
// ============================================================

import { parseMoney } from "./money";
import { templateAccountsRows, templateCategoryRows } from "./template";

export type CategoriaRow = {
  tipo: string;
  categoria: string;
  subcategoria?: string;
  presupuesto?: number;
};

export type CuentaRow = {
  nombre: string;
  tipo?: string;
  saldo?: number;
};

export type LocalRecord = {
  row: number;
  fecha: string;
  tipo: string;
  categoria: string;
  subcategoria?: string;
  descripcion: string;
  importe: number;
  cuenta?: string;
  estado?: string;
};

export type RecordInput = Omit<LocalRecord, "row">;

export type SqlValue = string | number | Uint8Array | null;

export type SqlQueryResult = { columns: string[]; values: SqlValue[][] };

interface SqlDatabase {
  run(sql: string, params?: SqlValue[]): void;
  exec(sql: string, params?: SqlValue[]): SqlQueryResult[];
  export(): Uint8Array;
  close(): void;
}

interface SqlJsModule {
  Database: new (data?: Uint8Array) => SqlDatabase;
}

type SqlJsInit = (config: { locateFile: (file: string) => string }) => Promise<SqlJsModule>;

declare global {
  interface Window {
    initSqlJs?: SqlJsInit;
  }
}

const OPFS_FILE = "cashview.cvw";
const IDB_NAME = "cashview";
const IDB_STORE = "kv";
const KEY_DB = "db";
const KEY_FILE_NAME = "fileName";
const KEY_LINKED = "linked";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  descripcion TEXT,
  importe REAL NOT NULL,
  cuenta TEXT,
  estado TEXT
);
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  presupuesto REAL
);
CREATE TABLE IF NOT EXISTS cuentas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo TEXT,
  saldo REAL
);
CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
PRAGMA user_version = 1;
`;

// ------------------------------------------------------------
// Carga del motor sql.js desde /wasm
// ------------------------------------------------------------

let sqlModulePromise: Promise<SqlJsModule> | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-sqljs]");
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar el motor SQLite.")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.dataset.sqljs = "1";
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("No se pudo cargar el motor SQLite."));
    document.head.appendChild(s);
  });
}

function initSql(): Promise<SqlJsModule> {
  if (sqlModulePromise) return sqlModulePromise;
  sqlModulePromise = (async () => {
    if (!isBrowser()) throw new Error("El almacén local solo está disponible en el navegador.");
    if (!window.initSqlJs) {
      await loadScript("/wasm/sql-wasm-browser.js");
    }
    return window.initSqlJs!({ locateFile: (file) => `/wasm/${file}` });
  })();
  return sqlModulePromise;
}

// ------------------------------------------------------------
// Almacenamiento en el navegador (IndexedDB + espejo OPFS)
// ------------------------------------------------------------

let idbPromise: Promise<IDBDatabase> | null = null;

function openIdb(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Tu navegador no soporta almacenamiento local."));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });
  return idbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function opfsAvailable(): boolean {
  return (
    isBrowser() &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.storage && typeof (navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> }).getDirectory === "function")
  );
}

async function opfsHandle(): Promise<FileSystemFileHandle | null> {
  try {
    if (!opfsAvailable()) return null;
    const root = await (navigator.storage as StorageManager & { getDirectory: () => Promise<FileSystemDirectoryHandle> }).getDirectory();
    const h = await root.getFileHandle(OPFS_FILE, { create: true });
    return h;
  } catch {
    return null;
  }
}

async function writeLocal(bytes: Uint8Array): Promise<void> {
  await idbSet(KEY_DB, bytes);
  const h = await opfsHandle();
  if (h) {
    try {
      const w = await h.createWritable();
      await w.write(new Uint8Array(bytes) as unknown as Blob);
      await w.close();
    } catch {
      // espejo OPFS opcional
    }
  }
}

async function readLocal(): Promise<Uint8Array | null> {
  try {
    const v = await idbGet<Uint8Array>(KEY_DB);
    if (v && v.byteLength > 0) return new Uint8Array(v);
  } catch {
    // continuar con el espejo
  }
  const h = await opfsHandle();
  if (h) {
    try {
      const f = await h.getFile();
      const buf = await f.arrayBuffer();
      if (buf.byteLength > 0) return new Uint8Array(buf);
    } catch {
      // sin espejo disponible
    }
  }
  return null;
}

let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(msg: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(msg, msg);
  writeQueue = next.catch(() => undefined);
  return next;
}

// ------------------------------------------------------------
// Instancia de la base + persistencia con autoguardado
// ------------------------------------------------------------

let dbInstance: SqlDatabase | null = null;
let dbInitPromise: Promise<SqlDatabase> | null = null;

function getDb(): Promise<SqlDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!dbInitPromise) dbInitPromise = initializeDb();
  return dbInitPromise;
}

function seed(db: SqlDatabase): void {
  db.run("BEGIN");
  try {
    for (const [tipo, categoria] of templateCategoryRows()) {
      db.run("INSERT INTO categorias (tipo, categoria, subcategoria, presupuesto) VALUES (?,?,?,?)", [
        String(tipo),
        String(categoria),
        "",
        0,
      ]);
    }
    for (const [nombre, tipo, saldo] of templateAccountsRows()) {
      db.run("INSERT INTO cuentas (nombre, tipo, saldo) VALUES (?,?,?)", [
        String(nombre),
        String(tipo),
        parseMoney(saldo),
      ]);
    }
    db.run("COMMIT");
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch {
      // noop
    }
    throw e;
  }
}

async function initializeDb(): Promise<SqlDatabase> {
  const SQL = await initSql();
  const bytes = await readLocal();
  let db: SqlDatabase | null = null;
  if (bytes) {
    try {
      db = new SQL.Database(bytes);
      db.exec("SELECT count(*) FROM sqlite_master");
    } catch {
      if (db) {
        try {
          db.close();
        } catch {
          // noop
        }
      }
      db = null;
    }
  }
  if (!db) {
    db = new SQL.Database();
    try {
      db.exec(SCHEMA);
      seed(db);
    } catch (e) {
      try {
        db.close();
      } catch {
        // noop
      }
      throw e;
    }
  } else {
    db.exec(SCHEMA);
  }
  dbInstance = db;
  await persistFromDb(db);
  return db;
}

async function persistFromDb(db: SqlDatabase): Promise<void> {
  const bytes = db.export();
  await enqueueWrite(async () => {
    await writeLocal(bytes);
    await saveToHandle(bytes);
  });
}

// Archivo real abierto (File System Access API)
let activeHandle: FileSystemFileHandle | null = null;

export function getActiveHandle(): FileSystemFileHandle | null {
  return activeHandle;
}

export function setActiveHandle(h: FileSystemFileHandle | null): void {
  activeHandle = h;
}

async function saveToHandle(bytes: Uint8Array): Promise<void> {
  const h = activeHandle;
  if (!h) return;
  try {
    const w = await h.createWritable();
    await w.write(new Uint8Array(bytes) as unknown as Blob);
    await w.close();
  } catch {
    // si el usuario no reautoriza el archivo, la copia sigue viva en el navegador
  }
}

// ------------------------------------------------------------
// Movimientos
// ------------------------------------------------------------

function rowFromSql(v: SqlValue[]): LocalRecord {
  return {
    row: Number(v[0]),
    fecha: String(v[1] ?? ""),
    tipo: String(v[2] ?? ""),
    categoria: String(v[3] ?? ""),
    subcategoria: v[4] ? String(v[4]) : undefined,
    descripcion: String(v[5] ?? ""),
    importe: Number(v[6] ?? 0),
    cuenta: v[7] ? String(v[7]) : undefined,
    estado: v[8] ? String(v[8]) : undefined,
  };
}

export async function listRecords(opts?: { from?: string; to?: string }): Promise<LocalRecord[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (opts?.from) {
    where.push("fecha >= ?");
    params.push(opts.from);
  }
  if (opts?.to) {
    where.push("fecha <= ?");
    params.push(opts.to);
  }
  const sql =
    "SELECT id, fecha, tipo, categoria, COALESCE(subcategoria,''), COALESCE(descripcion,''), importe, COALESCE(cuenta,''), COALESCE(estado,'') FROM movimientos" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY fecha DESC, id DESC";
  const res = db.exec(sql, params);
  return (res[0]?.values ?? []).map(rowFromSql);
}

export async function addRecord(input: RecordInput): Promise<void> {
  const db = await getDb();
  db.run(
    "INSERT INTO movimientos (fecha, tipo, categoria, subcategoria, descripcion, importe, cuenta, estado) VALUES (?,?,?,?,?,?,?,?)",
    [
      input.fecha,
      input.tipo,
      input.categoria,
      input.subcategoria ?? "",
      input.descripcion,
      parseMoney(input.importe),
      input.cuenta ?? "",
      input.estado ?? "Hecho",
    ]
  );
  await persistFromDb(db);
}

export async function updateRecord(row: number, input: RecordInput): Promise<void> {
  const db = await getDb();
  db.run(
    "UPDATE movimientos SET fecha=?, tipo=?, categoria=?, subcategoria=?, descripcion=?, importe=?, cuenta=?, estado=? WHERE id=?",
    [
      input.fecha,
      input.tipo,
      input.categoria,
      input.subcategoria ?? "",
      input.descripcion,
      parseMoney(input.importe),
      input.cuenta ?? "",
      input.estado ?? "Hecho",
      row,
    ]
  );
  await persistFromDb(db);
}

export async function deleteRecord(row: number): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM movimientos WHERE id = ?", [row]);
  await persistFromDb(db);
}

// ------------------------------------------------------------
// Catálogo (categorías y cuentas)
// ------------------------------------------------------------

export async function getCatalog(): Promise<{ categorias: CategoriaRow[]; cuentas: CuentaRow[] }> {
  const db = await getDb();
  const cats = db.exec("SELECT tipo, categoria, COALESCE(subcategoria,''), COALESCE(presupuesto,0) FROM categorias ORDER BY id")[0]?.values ?? [];
  const accs = db.exec("SELECT nombre, COALESCE(tipo,''), COALESCE(saldo,0) FROM cuentas ORDER BY id")[0]?.values ?? [];
  return {
    categorias: cats.map((v) => ({
      tipo: String(v[0] ?? "Gasto"),
      categoria: String(v[1] ?? ""),
      subcategoria: v[2] ? String(v[2]) : undefined,
      presupuesto: Number(v[3]) || undefined,
    })),
    cuentas: accs.map((v) => ({
      nombre: String(v[0] ?? ""),
      tipo: v[1] ? String(v[1]) : undefined,
      saldo: Number(v[2]) || undefined,
    })),
  };
}

export async function saveCatalog(categorias: CategoriaRow[], cuentas: CuentaRow[]): Promise<void> {
  const db = await getDb();
  db.run("BEGIN");
  try {
    db.run("DELETE FROM categorias");
    for (const c of categorias) {
      const nombre = c.categoria.trim();
      if (!nombre) continue;
      db.run("INSERT INTO categorias (tipo, categoria, subcategoria, presupuesto) VALUES (?,?,?,?)", [
        /ingr/i.test(c.tipo) ? "Ingreso" : "Gasto",
        nombre,
        (c.subcategoria ?? "").trim(),
        typeof c.presupuesto === "number" && Number.isFinite(c.presupuesto) ? c.presupuesto : 0,
      ]);
    }
    db.run("DELETE FROM cuentas");
    for (const a of cuentas) {
      const nombre = a.nombre.trim();
      if (!nombre) continue;
      db.run("INSERT INTO cuentas (nombre, tipo, saldo) VALUES (?,?,?)", [
        nombre,
        (a.tipo ?? "").trim(),
        typeof a.saldo === "number" && Number.isFinite(a.saldo) ? a.saldo : 0,
      ]);
    }
    db.run("COMMIT");
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch {
      // noop
    }
    throw e;
  }
  await persistFromDb(db);
}

// ------------------------------------------------------------
// Archivo .cvw: nuevo, exportar, importar y File System Access
// ------------------------------------------------------------

export async function exportFile(): Promise<Uint8Array> {
  const db = await getDb();
  return db.export();
}

export async function importFile(bytes: Uint8Array): Promise<void> {
  const SQL = await initSql();
  let ndb: SqlDatabase;
  try {
    ndb = new SQL.Database(bytes);
    ndb.exec("SELECT count(*) FROM sqlite_master");
  } catch {
    throw new Error("Ese archivo no es una base SQLite válida.");
  }
  try {
    ndb.exec(SCHEMA);
    const colRes = ndb.exec("PRAGMA table_info(movimientos)");
    const cols = (colRes[0]?.values ?? []).map((v) => String(v[1]));
    if (cols.length && !["fecha", "tipo", "importe"].every((c) => cols.includes(c))) {
      throw new Error("formato");
    }
  } catch (e) {
    try {
      ndb.close();
    } catch {
      // noop
    }
    if ((e as Error).message === "formato") {
      throw new Error("Ese archivo no parece un archivo CashView (.cvw) válido.");
    }
    throw new Error("No se pudo abrir ese archivo.");
  }

  const old = dbInstance;
  if (old) {
    try {
      old.close();
    } catch {
      // noop
    }
  }
  dbInstance = ndb;
  dbInitPromise = Promise.resolve(ndb);
  setActiveHandle(null);
  await setLinked(false);
  await persistFromDb(ndb);
}

export async function newFile(): Promise<void> {
  const SQL = await initSql();
  const ndb = new SQL.Database();
  ndb.exec(SCHEMA);
  seed(ndb);
  const old = dbInstance;
  if (old) {
    try {
      old.close();
    } catch {
      // noop
    }
  }
  dbInstance = ndb;
  dbInitPromise = Promise.resolve(ndb);
  setActiveHandle(null);
  await setLinked(false);
  await setFileName("CashView.cvw");
  await persistFromDb(ndb);
}

export function fsaSupported(): boolean {
  return isBrowser() && Boolean(window.showOpenFilePicker || window.showSaveFilePicker);
}

export async function openFileFromDisk(): Promise<{ name: string }> {
  if (!window.showOpenFilePicker) {
    throw new Error("Tu navegador no soporta abrir archivos. Usa la opción Importar.");
  }
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: "Base CashView", accept: { "application/octet-stream": [".cvw"] } }],
  });
  const file = await handle.getFile();
  const buf = await file.arrayBuffer();
  if (!buf.byteLength) throw new Error("El archivo está vacío.");
  await importFile(new Uint8Array(buf));
  setActiveHandle(handle);
  await setLinked(true);
  await setFileName(file.name);
  return { name: file.name };
}

export async function saveFileToDisk(): Promise<{ name: string }> {
  if (!window.showSaveFilePicker) {
    throw new Error("Tu navegador no soporta guardar archivos. Usa la opción Exportar.");
  }
  const bytes = await exportFile();
  const base = await getFileName();
  const handle = await window.showSaveFilePicker({
    suggestedName: base.endsWith(".cvw") ? base : `${base}.cvw`,
    types: [{ description: "Base CashView", accept: { "application/octet-stream": [".cvw"] } }],
  });
  const w = await handle.createWritable();
  await w.write(new Uint8Array(bytes) as unknown as Blob);
  await w.close();
  setActiveHandle(handle);
  await setLinked(true);
  await setFileName(handle.name);
  return { name: handle.name };
}

export async function unlinkFile(): Promise<void> {
  setActiveHandle(null);
  await setLinked(false);
}

export function downloadFile(bytes: Uint8Array, name: string): void {
  const blob = new Blob([new Uint8Array(bytes) as unknown as BlobPart], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ------------------------------------------------------------
// Metadatos del archivo
// ------------------------------------------------------------

export async function getFileName(): Promise<string> {
  const v = await idbGet<string>(KEY_FILE_NAME);
  return v || "CashView.cvw";
}

export async function setFileName(name: string): Promise<void> {
  await idbSet(KEY_FILE_NAME, name);
}

export async function isLinkedToFile(): Promise<boolean> {
  return Boolean(await idbGet<boolean>(KEY_LINKED));
}

export async function setLinked(v: boolean): Promise<void> {
  await idbSet(KEY_LINKED, v);
}

// ------------------------------------------------------------
// Ajustes del usuario (se guardan dentro del propio .cvw)
// ------------------------------------------------------------

export async function getAjuste(clave: string): Promise<string | undefined> {
  const db = await getDb();
  const res = db.exec("SELECT valor FROM ajustes WHERE clave = ?", [clave]);
  const row = res[0]?.values?.[0];
  return row ? String(row[0]) : undefined;
}

export async function setAjuste(clave: string, valor: string): Promise<void> {
  const db = await getDb();
  db.run(
    "INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
    [clave, valor]
  );
  await persistFromDb(db);
}