/**
 * Cálculos de precios variables según configuración del sistema.
 *
 * Fuentes de verdad (espejo del frontend, server/src/lib/precios.ts
 * está duplicado en src/components/servicios/ServicioWizard.tsx
 * para que coincidan):
 *   - Permiso de Poda: depende de la altura
 *       altura >= 3m  → 1.5 × vvuma
 *       altura <  3m  → 0.5 × vvuma
 *   - Permiso de Derribo: cálculo volumétrico (ver
 *     /Users/andro/Downloads/CalculadoraIMBIO.html, sección 1).
 *     Fórmula:
 *       P(m) = CAP(cm) / 100
 *       g = P² / (4π)            ← área basal (m²)
 *       V fuste  = g × h × f     ← volumen del fuste (m³)
 *       V total  = V fuste × 1.20  ← biomasa total (+20% ramas/copa)
 *       Costo    = V total × vvuma_especie
 *     Tarifas por especie:
 *       Tarifa I  (30 vvuma/m³): mezquite, huizache, sabino, yuca
 *       Tarifa II ( 5 vvuma/m³): pirul, pino
 *       Tarifa III ( 8 vvuma/m³, mín 6 vvuma): otra
 *
 * vvuma se lee de la tabla Configuracion (singleton, id=1). Si la
 * fila no existe todavía (caso edge durante el primer arranque) se
 * usa el valor por defecto histórico de 117.31.
 */

import { prisma } from "../prisma";

/** Valor por defecto si la config no tiene vvuma. */
export const VVUMA_DEFAULT = 117.31;

/** Factor multiplicador para árboles >= 3m. */
export const FACTOR_PODA_ALTO = 1.5;

/** Factor multiplicador para árboles < 3m. */
export const FACTOR_PODA_BAJO = 0.5;

/** Altura umbral (en metros) para aplicar el factor alto. */
export const UMBRAL_ALTURA_PODA = 3;

/** Factores para Permiso de Derribo. */
export const FACTOR_DERRIBO_PIRUL_PINO = 5;
export const FACTOR_DERRIBO_MEZQ_HUIZ_YUCA_SABINO = 30;
export const FACTOR_DERRIBO_OTRO = 4;

/**
 * Factores para Servicio de Poda, según rangos de altura:
 *   0  – 10m  → 4
 *   10 – 14m  → 8
 *   14 – 20m  → 12
 *   > 20m     → 16
 */
export const FACTOR_SERVICIO_PODA_RANGO_1 = 4;
export const FACTOR_SERVICIO_PODA_RANGO_2 = 8;
export const FACTOR_SERVICIO_PODA_RANGO_3 = 12;
export const FACTOR_SERVICIO_PODA_RANGO_4 = 16;
export const SERVICIO_PODA_COTA_RANGO_1 = 10;
export const SERVICIO_PODA_COTA_RANGO_2 = 14;
export const SERVICIO_PODA_COTA_RANGO_3 = 20;

/**
 * Factores para Servicio de Derribo, según rangos de altura:
 *   0  – 9.9m  → 15
 *   10 – 19.9m → 30
 *   > 20m      → 45
 */
export const FACTOR_SERVICIO_DERRIBO_RANGO_1 = 15;
export const FACTOR_SERVICIO_DERRIBO_RANGO_2 = 30;
export const FACTOR_SERVICIO_DERRIBO_RANGO_3 = 45;
export const SERVICIO_DERRIBO_COTA_RANGO_1 = 10;
export const SERVICIO_DERRIBO_COTA_RANGO_2 = 20;

/**
 * Especies que se tarifan a 30× vvuma en el Permiso de Derribo.
 * Comparación case-insensitive.
 */
export const ESPECIES_DERRIBO_30X: readonly string[] = [
  "mezquite",
  "huizache",
  "yuca",
  "sabino",
];

/**
 * Especies que se tarifan a 5× vvuma en el Permiso de Derribo.
 * Comparación case-insensitive; "Pino" también acepta "Pino Piñonero",
 * "Pino Gregorio", etc.
 */
export const ESPECIES_DERRIBO_5X: readonly string[] = ["pirul"];

const PINO_PREFIX = "pino";

/**
 * Obtiene el valor actual de vvuma de la configuración.
 * Si no existe la fila, crea la configuración con el default y
 * devuelve VVUMA_DEFAULT.
 */
export async function obtenerVvuma(): Promise<number> {
  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    create: { id: 1, vvuma: VVUMA_DEFAULT },
    update: {},
  });
  return config.vvuma ? Number(config.vvuma) : VVUMA_DEFAULT;
}

/**
 * Redondea a 2 decimales para coincidir con Decimal(10, 2) del schema.
 * Usa el método "banker's rounding" de Prisma/MySQL/PG para evitar
 * drift acumulado.
 */
function redondearPrecio(n: number): number {
  return Math.round(n * 100) / 100;
}

// =================================================================
// PERMISO DE DERRIBO — Tarifa volumétrica (CalculadoraIMBIO.html)
// =================================================================
//
// Cada especie tiene:
//   - vvuma/m³: vvuma por metro cúbico de biomasa
//   - minimo: vvuma mínimo a cobrar (sólo Tarifa III lo tiene)
//   - factor: factor de forma sugerido (f) — el operador puede
//     ajustarlo en el wizard, pero se autorrellena al elegir
//   - nombre: nombre legible para mostrar
//   - cientifico: nombre científico (para autorrellenar en PDF)

export interface TarifaDerribo {
  vvuma: number;
  minimo: number;
  factor: number;
  nombre: string;
  cientifico: string;
}

export const TARIFAS_DERRIBO: Record<string, TarifaDerribo> = {
  mezquite: {
    vvuma: 30,
    minimo: 0,
    factor: 0.6,
    nombre: "Mezquite",
    cientifico: "Prosopis laevigata",
  },
  huizache: {
    vvuma: 30,
    minimo: 0,
    factor: 0.55,
    nombre: "Huizache",
    cientifico: "Acacia spp.",
  },
  sabino: {
    vvuma: 30,
    minimo: 0,
    factor: 0.7,
    nombre: "Sabino / Ahuehuete",
    cientifico: "Taxodium mucronatum",
  },
  yuca: {
    vvuma: 30,
    minimo: 0,
    factor: 0.55,
    nombre: "Yuca",
    cientifico: "Yucca spp.",
  },
  pirul: {
    vvuma: 5,
    minimo: 0,
    factor: 0.62,
    nombre: "Pirul",
    cientifico: "Schinus molle",
  },
  pino: {
    vvuma: 5,
    minimo: 0,
    factor: 0.45,
    nombre: "Pino",
    cientifico: "Pinus spp.",
  },
  // ----- Tarifa III (8 vvuma/m³, mín 6 vvuma) — Otras Especies -----
  // Factores de forma tomados del array `factoresUrbanos` de
  // /Users/andro/Downloads/CalculadoraIMBIO.html. Si se agrega una
  // especie nueva, añadirla acá y al seed del campo `especie`.
  eucalipto: {
    vvuma: 8,
    minimo: 6,
    factor: 0.55,
    nombre: "Eucalipto",
    cientifico: "Eucalyptus spp.",
  },
  trueno: {
    vvuma: 8,
    minimo: 6,
    factor: 0.65,
    nombre: "Trueno",
    cientifico: "Ligustrum lucidum",
  },
  pata_vaca: {
    vvuma: 8,
    minimo: 6,
    factor: 0.58,
    nombre: "Pata de vaca",
    cientifico: "Bauhinia variegata",
  },
  fresno: {
    vvuma: 8,
    minimo: 6,
    factor: 0.68,
    nombre: "Fresno",
    cientifico: "Fraxinus uhdei",
  },
  jacaranda: {
    vvuma: 8,
    minimo: 6,
    factor: 0.6,
    nombre: "Jacaranda",
    cientifico: "Jacaranda mimosifolia",
  },
  ficus: {
    vvuma: 8,
    minimo: 6,
    factor: 0.72,
    nombre: "Ficus",
    cientifico: "Ficus benjamina / nitida",
  },
  cedro_blanco: {
    vvuma: 8,
    minimo: 6,
    factor: 0.48,
    nombre: "Cedro blanco",
    cientifico: "Cupressus lindleyi",
  },
  paraiso: {
    vvuma: 8,
    minimo: 6,
    factor: 0.62,
    nombre: "Árbol del paraíso",
    cientifico: "Melia azedarach",
  },
  colorin: {
    vvuma: 8,
    minimo: 6,
    factor: 0.55,
    nombre: "Colorín / Zompantle",
    cientifico: "Erythrina americana",
  },
  sauce: {
    vvuma: 8,
    minimo: 6,
    factor: 0.65,
    nombre: "Sauce llorón",
    cientifico: "Salix babylonica",
  },
  otra: {
    // Opción genérica: cualquier especie no listada explícitamente.
    // Mismas reglas que las Otras Especies (Tarifa III).
    vvuma: 8,
    minimo: 6,
    factor: 0.65,
    nombre: "Otra especie",
    cientifico: "",
  },
};

/** Devuelve la tarifa para una especie, o null si no existe. */
export function tarifaDerriboPara(
  especie: string | null | undefined,
): TarifaDerribo | null {
  if (!especie) return null;
  return TARIFAS_DERRIBO[especie] ?? null;
}

/** Devuelve el factor de forma sugerido para una especie. */
export function factorFormaDerriboPara(
  especie: string | null | undefined,
): number | null {
  const t = tarifaDerriboPara(especie);
  return t ? t.factor : null;
}

/**
 * Devuelve el factor de derribo que aplica a un nombre común.
 *   - Pirul                → 5
 *   - Pino (cualquier)     → 5
 *   - Mezquite/Huizache/
 *     Yuca/Sabino         → 30
 *   - Cualquier otro       → 4
 *
 * NOTA: Esta función se mantiene para compatibilidad con versiones
 * anteriores y como fallback cuando el trámite no tiene los campos
 * nuevos (especie, perimetro, factorForma). Para el cálculo oficial
 * del Permiso de Derribo, usar `calcularPrecioDerriboVolumetrico`.
 */
export function factorDerriboPara(nombreComun: string | null | undefined): number {
  if (!nombreComun) return FACTOR_DERRIBO_OTRO;
  const n = normalizarNombre(nombreComun);

  if (ESPECIES_DERRIBO_30X.includes(n)) {
    return FACTOR_DERRIBO_MEZQ_HUIZ_YUCA_SABINO;
  }
  if (ESPECIES_DERRIBO_5X.includes(n) || n.startsWith(PINO_PREFIX)) {
    return FACTOR_DERRIBO_PIRUL_PINO;
  }
  return FACTOR_DERRIBO_OTRO;
}

/**
 * Resultado detallado del cálculo volumétrico de un Permiso de
 * Derribo. Útil para mostrar el desglose en el wizard y el PDF.
 */
export interface DerriboVolumetrico {
  /** Especie (key: mezquite, huizache, sabino, yuca, pirul, pino, otra) */
  especie: string;
  /** Perímetro en metros (CAP / 100) */
  perimetroM: number;
  /** Área basal en m²: P² / (4π) */
  areaBasal: number;
  /** Altura del árbol en metros */
  altura: number;
  /** Factor de forma (f) usado */
  factorForma: number;
  /** Volumen del fuste en m³: g × h × f */
  volumenFuste: number;
  /** Biomasa total en m³: V fuste × 1.20 (+20% ramas/copa) */
  volumenTotal: number;
  /** Tarifa por m³ de la especie (vvuma/m³) */
  vvumaPorM3: number;
  /** Costo antes de aplicar mínimo (en pesos) */
  costoRaw: number;
  /** true si se aplicó el mínimo de la Tarifa III */
  aplicaMinimo: boolean;
  /** Costo final en pesos (con mínimo aplicado si corresponde) */
  costo: number;
}

/**
 * Calcula el precio del Permiso de Derribo con la fórmula
 * volumétrica oficial (ver /Users/andro/Downloads/CalculadoraIMBIO.html,
 * sección 1, función `calcularPermiso`).
 *
 * Fórmula:
 *   P(m)  = CAP(cm) / 100
 *   g     = P² / (4π)                       ← área basal (m²)
 *   V fuste = g × h × f
 *   V total = V fuste × 1.20                 ← biomasa total
 *   Costo   = V total × vvuma_especie
 *   Si Tarifa III (otra) y Costo < 6 vvuma  → Costo = 6 vvuma × vvuma_pesos
 *
 * Recibe los datos del formulario como objeto (Record<string, unknown>)
 * para leerlos de forma tolerante a strings o números.
 *
 * Devuelve el desglose completo o null si falta algún dato o la
 * especie no está reconocida.
 */
export function calcularPrecioDerriboVolumetrico(
  datos: Record<string, unknown> | null | undefined,
  vvuma: number,
): DerriboVolumetrico | null {
  if (!datos) return null;
  const especie = stringValOrNull(datos.especie);
  const perimetro = toNumberOrNull(datos.perimetro);
  const altura = toNumberOrNull(datos.altura);
  const factorForma = toNumberOrNull(datos.factorForma);
  if (!especie || perimetro === null || altura === null || factorForma === null) {
    return null;
  }
  if (perimetro <= 0 || altura <= 0 || factorForma <= 0) return null;

  const t = tarifaDerriboPara(especie);
  if (!t) return null;

  const perimetroM = perimetro / 100;
  const areaBasal = (perimetroM * perimetroM) / (4 * Math.PI);
  const volumenFuste = areaBasal * altura * factorForma;
  const volumenTotal = volumenFuste * 1.2;
  const costoRaw = redondearPrecio(volumenTotal * t.vvuma * vvuma);
  const aplicaMinimo = t.minimo > 0 && volumenTotal * t.vvuma < t.minimo;
  const costo = aplicaMinimo
    ? redondearPrecio(t.minimo * vvuma)
    : costoRaw;

  return {
    especie,
    perimetroM,
    areaBasal,
    altura,
    factorForma,
    volumenFuste,
    volumenTotal,
    vvumaPorM3: t.vvuma,
    costoRaw,
    aplicaMinimo,
    costo,
  };
}

/**
 * Calcula el precio de un Permiso de Derribo a partir de los datos
 * del formulario (especie, perimetro, altura, factorForma) y el
 * valor de vvuma configurado.
 *
 * Devuelve null si faltan datos o la especie no es válida.
 */
export function calcularPrecioDerribo(
  datos: Record<string, unknown> | null | undefined,
  vvuma: number,
): number | null {
  const r = calcularPrecioDerriboVolumetrico(datos, vvuma);
  return r ? r.costo : null;
}

// Helpers de normalización para la nueva API
function stringValOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? null : s;
  }
  return String(v);
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Normaliza el nombre común para hacer comparaciones (legacy). */
function normalizarNombre(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Calcula el precio de un Permiso de Poda a partir de la altura
 * del árbol y el valor de vvuma configurado.
 *
 *   altura >= 3  → 1.5 × vvuma
 *   altura <  3  → 0.5 × vvuma
 *
 * Devuelve null si la altura no es un número válido o es negativa.
 */
export function calcularPrecioPoda(
  altura: number | string | null | undefined,
  vvuma: number,
): number | null {
  if (altura === null || altura === undefined || altura === "") return null;
  const h = typeof altura === "string" ? Number(altura) : altura;
  if (!Number.isFinite(h) || h < 0) return null;
  const factor =
    h >= UMBRAL_ALTURA_PODA ? FACTOR_PODA_ALTO : FACTOR_PODA_BAJO;
  return redondearPrecio(vvuma * factor);
}

/**
 * Devuelve el factor a aplicar para el Servicio de Poda según la
 * altura del árbol:
 *   0  – 10m  → 4
 *   10 – 14m  → 8
 *   14 – 20m  → 12
 *   > 20m     → 16
 */
export function factorServicioPodaPara(altura: number): number {
  if (altura <= SERVICIO_PODA_COTA_RANGO_1) return FACTOR_SERVICIO_PODA_RANGO_1;
  if (altura <= SERVICIO_PODA_COTA_RANGO_2) return FACTOR_SERVICIO_PODA_RANGO_2;
  if (altura <= SERVICIO_PODA_COTA_RANGO_3) return FACTOR_SERVICIO_PODA_RANGO_3;
  return FACTOR_SERVICIO_PODA_RANGO_4;
}

/**
 * Calcula el precio de un Servicio de Poda a partir de la altura
 * del árbol y el valor de vvuma configurado.
 *
 *   0  – 10m  → 4 × vvuma
 *   10 – 14m  → 8 × vvuma
 *   14 – 20m  → 12 × vvuma
 *   > 20m     → 16 × vvuma
 *
 * Devuelve null si la altura no es un número válido o es negativa.
 */
export function calcularPrecioServicioPoda(
  altura: number | string | null | undefined,
  vvuma: number,
): number | null {
  if (altura === null || altura === undefined || altura === "") return null;
  const h = typeof altura === "string" ? Number(altura) : altura;
  if (!Number.isFinite(h) || h < 0) return null;
  return redondearPrecio(vvuma * factorServicioPodaPara(h));
}

/**
 * Devuelve el factor a aplicar para el Servicio de Derribo según
 * la altura del árbol:
 *   < 10m  → 15
 *   < 20m  → 30
 *   ≥ 20m  → 45
 */
export function factorServicioDerriboPara(altura: number): number {
  if (altura < SERVICIO_DERRIBO_COTA_RANGO_1) return FACTOR_SERVICIO_DERRIBO_RANGO_1;
  if (altura < SERVICIO_DERRIBO_COTA_RANGO_2) return FACTOR_SERVICIO_DERRIBO_RANGO_2;
  return FACTOR_SERVICIO_DERRIBO_RANGO_3;
}

/**
 * Calcula el precio de un Servicio de Derribo a partir de la altura
 * del árbol y el valor de vvuma configurado.
 *
 *   0  – 9.9m  → 15 × vvuma
 *   10 – 19.9m → 30 × vvuma
 *   ≥ 20m      → 45 × vvuma
 *
 * Devuelve null si la altura no es un número válido o es negativa.
 */
export function calcularPrecioServicioDerribo(
  altura: number | string | null | undefined,
  vvuma: number,
): number | null {
  if (altura === null || altura === undefined || altura === "") return null;
  const h = typeof altura === "string" ? Number(altura) : altura;
  if (!Number.isFinite(h) || h < 0) return null;
  return redondearPrecio(vvuma * factorServicioDerriboPara(h));
}

// =================================================================
// USO_CONTENEDORES — precio por tipo de generador × meses del permiso
// =================================================================
//
// Tipos de generador con su factor multiplicador de VVUMA. La lista
// y los strings deben coincidir EXACTAMENTE con el frontend
// (TIPOS_GENERADOR_CONTENEDOR en ServicioWizard.tsx) y con las
// opciones del campo `tipoGenerador` en el seed.
//
//   precio = factor(tipoGenerador) × VVUMA × mesesPermiso
//
// La fecha de vencimiento de la autorización se calcula como
// `fechaEmision + mesesPermiso` (helper `calcularVencimientoContenedor`).
//
export const TIPOS_GENERADOR_CONTENEDOR: readonly {
  value: string;
  factor: number;
}[] = [
  { value: "Micro-generador (1-40 kg/semana)", factor: 3 },
  { value: "Pequeño generador (40-80 kg/semana)", factor: 4 },
  { value: "Pequeño generador (80-150 kg/semana)", factor: 6 },
  { value: "Pequeño generador (150-180 kg/semana)", factor: 8 },
  { value: "Pequeño generador (180-200 kg/semana)", factor: 11 },
];

/**
 * Devuelve el factor (multiplicador de VVUMA) asociado a un tipo de
 * generador de residuos sólidos. Devuelve null si el tipo no está
 * reconocido.
 */
export function factorTipoGeneradorContenedor(
  tipoGenerador: string | null | undefined,
): number | null {
  if (!tipoGenerador) return null;
  const found = TIPOS_GENERADOR_CONTENEDOR.find((t) => t.value === tipoGenerador);
  return found ? found.factor : null;
}

/**
 * Calcula el precio de un Permiso de Uso de Contenedores.
 *
 *   precio = factor(tipoGenerador) × VVUMA × mesesPermiso
 *
 * Devuelve null si falta el tipo de generador o los meses son
 * inválidos (<= 0, no número, etc.).
 */
export function calcularPrecioUsoContenedores(
  tipoGenerador: string | null | undefined,
  mesesPermiso: number | string | null | undefined,
  vvuma: number,
): number | null {
  const factor = factorTipoGeneradorContenedor(tipoGenerador);
  if (factor === null) return null;
  if (mesesPermiso === null || mesesPermiso === undefined || mesesPermiso === "") {
    return null;
  }
  const m = typeof mesesPermiso === "string" ? Number(mesesPermiso) : mesesPermiso;
  if (!Number.isFinite(m) || m <= 0) return null;
  return redondearPrecio(factor * vvuma * m);
}

/**
 * Calcula la fecha de vencimiento de una autorización de
 * USO_CONTENEDORES sumando `mesesPermiso` meses a `fechaEmision`.
 *
 * - fechaEmision: Date o string ISO.
 * - mesesPermiso: número entero de meses.
 *
 * Devuelve null si mesesPermiso no es un entero positivo.
 *
 * Nota: usamos `setMonth` que ajusta automáticamente si el día no
 * existe en el mes destino (ej. 31 de enero → 28 de febrero). Para
 * permisos de meses completos esto es deseable: el permiso vence
 * al final del mes.
 */
export function calcularVencimientoContenedor(
  fechaEmision: Date | string,
  mesesPermiso: number | string | null | undefined,
): Date | null {
  if (mesesPermiso === null || mesesPermiso === undefined || mesesPermiso === "") {
    return null;
  }
  const m = typeof mesesPermiso === "string" ? Number(mesesPermiso) : mesesPermiso;
  if (!Number.isFinite(m) || m <= 0) return null;
  const base = fechaEmision instanceof Date ? fechaEmision : new Date(fechaEmision);
  if (isNaN(base.getTime())) return null;
  const result = new Date(base);
  result.setMonth(result.getMonth() + Math.floor(m));
  return result;
}
