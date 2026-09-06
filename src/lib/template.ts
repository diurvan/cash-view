// ============================================================
// PLANTILLA Estándar de cashview (archivo de arranque).
// El archivo base "CashView.xlsx" se crea con este modelo y es
// la semilla que recibe cualquier usuario nuevo del PWA.
// ============================================================

export const templateSpreadsheetName = "CashView.xlsx";

export const tipos = ["Ingreso", "Gasto"];

export const categoriasIngreso = [
  "Sueldo",
  "Freelance",
  "Ventas",
  "Inversiones",
  "Rentas",
  "Otros",
];

export const categoriasGasto = [
  "Vivienda",
  "Alimentación",
  "Transporte",
  "Salud",
  "Educación",
  "Ocio",
  "Suscripciones",
  "Ropa",
  "Hogar",
  "Impuestos",
  "Ahorro",
  "Otros",
];

export const subcategoriasIngreso = [
  "Sueldo mensual",
  "Proyecto",
  "Comisiones",
  "Producto",
  "Dividendos",
  "Arriendo",
  "Bonos",
  "Regalos",
  "Reembolso",
  "Otros",
];

export const subcategoriasGasto = [
  "Arriendo",
  "Hipoteca",
  "Servicios",
  "Alquiler",
  "Supermercado",
  "Mercado",
  "Delivery",
  "Restaurante",
  "Café",
  "Combustible",
  "Taxi",
  "Pasaje",
  "Mantenimiento",
  "Consultas",
  "Medicinas",
  "Seguro",
  "Matrícula",
  "Cursos",
  "Materiales",
  "Cine",
  "Salidas",
  "Viajes",
  "Streaming",
  "Software",
  "Gimnasio",
  "Ropa nueva",
  "Limpieza",
  "Muebles",
  "Sueldos",
  "Regalos",
  "Impuestos",
  "Ahorro fijo",
  "Emergencia",
  "Otros",
];

export const subcategorias = [...subcategoriasIngreso, ...subcategoriasGasto];

export const metaMedios = [
  "Efectivo",
  "Banco",
  "Yape/Transferencia",
  "Tarjeta de crédito",
  "Tarjeta de débito",
];

export const estados = ["Hecho", "Pendiente"];

export type SheetDef = {
  title: string;
  headers: string[];
  widths: number[];
  freezeRows: number;
  exampleRows?: (string | number)[][];
};

/** Filas de la pestaña Categorías (Tipo · Categoría · Subcategoría · Presupuesto) */
export function templateCategoryRows(): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const ingreso of categoriasIngreso) rows.push(["Ingreso", ingreso, "", 0]);
  for (const gasto of categoriasGasto) rows.push(["Gasto", gasto, "", 0]);
  return rows;
}

/** Filas de la pestaña Cuentas (Nombre · Tipo · Saldo inicial) */
export function templateAccountsRows(): (string | number)[][] {
  return [
    ["Efectivo", "Efectivo", 0],
    ["Banco principal", "Cuenta corriente", 0],
    ["Yape", "Billetera digital", 0],
    ["Tarjeta de crédito", "Crédito", 0],
  ];
}

export function templateExampleRow(): (string | number)[] {
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate()
  ).padStart(2, "0")}`;
  return [
    iso,
    "Gasto",
    "Alimentación",
    "Supermercado",
    "(ejemplo) Mercadito",
    25.5,
    "Efectivo",
    "Hecho",
  ];
}

export const templateSheets: SheetDef[] = [
  {
    title: "Movimientos",
    headers: [
      "Fecha",
      "Tipo",
      "Categoría",
      "Subcategoría",
      "Descripción",
      "Importe",
      "Cuenta/Medio",
      "Estado",
    ],
    widths: [110, 100, 150, 150, 260, 110, 170, 100],
    freezeRows: 1,
  },
  {
    title: "Categorías",
    headers: ["Tipo", "Categoría", "Subcategoría", "Presupuesto mensual"],
    widths: [100, 180, 200, 160],
    freezeRows: 1,
  },
  {
    title: "Cuentas",
    headers: ["Nombre", "Tipo", "Saldo inicial"],
    widths: [180, 200, 120],
    freezeRows: 1,
  },
];

export function tabOfHeader(header: string): "Movimientos" | "Categorías" | "Cuentas" | undefined {
  const h = header.trim().toLowerCase();
  if (h.includes("fecha") || h.includes("importe") || h.includes("monto")) return "Movimientos";
  if (h.includes("presupuesto") || h.includes("categoria")) return "Categorías";
  if (h.includes("saldo") || h.includes("cuenta") || h.includes("nombre")) return "Cuentas";
  return undefined;
}