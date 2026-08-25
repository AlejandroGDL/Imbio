/**
 * Convierte un número a su representación en letras en español (MX).
 * Soporta números entre 0 y 999,999,999.99
 *
 * Ejemplos:
 *   1 → "uno"
 *   1.50 → "uno 50/100 M.N."
 *   100 → "cien"
 *   350.50 → "trescientos cincuenta 50/100 M.N."
 */

const UNIDADES = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];

const DECENAS = [
  "",
  "",
  "",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];

const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function tresDigitos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";

  let result = "";

  const centenas = Math.floor(n / 100);
  const resto = n % 100;

  if (centenas > 0) {
    result += CENTENAS[centenas] + " ";
  }

  if (resto < 30) {
    result += UNIDADES[resto];
  } else {
    const decenas = Math.floor(resto / 10);
    const unidades = resto % 10;
    result += DECENAS[decenas];
    if (unidades > 0) {
      result += " y " + UNIDADES[unidades];
    }
  }

  return result.trim();
}

function numeroEnteroALetras(n: number): string {
  if (n === 0) return "cero";
  if (n === 1) return "uno";

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    if (millones === 1) {
      partes.push("un millón");
    } else {
      partes.push(tresDigitos(millones) + " millones");
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      partes.push("mil");
    } else {
      partes.push(tresDigitos(miles) + " mil");
    }
  }

  if (unidades > 0) {
    partes.push(tresDigitos(unidades));
  }

  return partes.join(" ").trim();
}

/**
 * Convierte un número decimal a letras en formato MX.
 *
 * @example
 *   numeroALetras(1)       → "uno"
 *   numeroALetras(1.50)    → "uno 50/100 M.N."
 *   numeroALetras(350.50) → "trescientos cincuenta 50/100 M.N."
 *   numeroALetras(1234)    → "un mil doscientos treinta y cuatro"
 */
export function numeroALetras(monto: number): string {
  if (!Number.isFinite(monto) || monto < 0) return "cero";

  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  // Caso especial: 1 → "uno" (no "un peso")
  const letras = numeroEnteroALetras(entero);
  const centStr = String(centavos).padStart(2, "0");

  return `${letras} ${centStr}/100 M.N.`;
}
