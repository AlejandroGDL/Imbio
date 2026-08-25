/**
 * Hash determinístico en JS puro (DJB2 + variante).
 *
 * NO usa Web Crypto API porque `crypto.subtle` no está disponible
 * en páginas HTTP servidas desde una IP privada (solo en HTTPS o
 * localhost/127.0.0.1). Eso rompía el memorandum al abrir la app
 * desde otra PC de la LAN.
 *
 * No es criptográficamente seguro — solo sirve como "cadena de
 * seguridad" visual del PDF. Para integridad real, usar SHA-256
 * server-side.
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + c
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // a unsigned
}

function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // hash * 16777619 mod 2^32
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Genera un hash hex de 32 chars combinando DJB2 y FNV-1a
 * (8 chars cada uno + padding). Suficiente para identificadores
 * visuales únicos.
 */
export function generarHashHex32(texto: string): string {
  const a = djb2Hash(texto);
  const b = fnv1aHash(texto);
  // Combinar 4 pasadas para más entropía
  const c = djb2Hash(texto + "_1");
  const d = fnv1aHash(texto + "_2");
  const parts = [a, b, c, d].map((n) => n.toString(16).padStart(8, "0"));
  return parts.join("").slice(0, 32);
}

/**
 * Genera un "salt" aleatorio en hex de 16 chars usando
 * `Math.random` (suficiente para cadena visual, no criptográfica).
 * No usa `crypto.getRandomValues` por compatibilidad con HTTP en LAN.
 */
function generarSaltHex16(): string {
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

/**
 * Genera la cadena de seguridad del memorandum con el formato:
 *   IMBIO-MEMO-<folio>-<yyyymmddhhmmss>-<hash>
 *
 * @example
 *   IMBIO-MEMO-SOL-2026-00093-20260818215213-5245673902b04ade88290b0bcf98f2
 */
export function generarCadenaSeguridad(
  folio: string,
  fecha: Date = new Date(),
): string {
  const yyyy: string = String(fecha.getFullYear());
  const mm: string = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd: string = String(fecha.getDate()).padStart(2, "0");
  const hh: string = String(fecha.getHours()).padStart(2, "0");
  const mi: string = String(fecha.getMinutes()).padStart(2, "0");
  const ss: string = String(fecha.getSeconds()).padStart(2, "0");
  const timestamp: string = yyyy + mm + dd + hh + mi + ss;

  const salt = generarSaltHex16();
  const hash = generarHashHex32(`${folio}-${timestamp}-${salt}`);

  return `IMBIO-MEMO-${folio}-${timestamp}-${hash}`;
}
