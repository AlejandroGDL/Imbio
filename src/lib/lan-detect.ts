/**
 * Detección de IPs LAN del cliente.
 *
 * Usa el truco de WebRTC ICE candidates para descubrir las IPs
 * locales de la PC que está corriendo el navegador. Esto NO requiere
 * ningún permiso especial y funciona en todos los navegadores
 * modernos (salvo Firefox móvil en algunos casos).
 *
 * Devuelve la lista de IPs candidatas. Suelen incluir:
 * - 127.0.0.1 (loopback)
 * - IPs internas de la PC (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * - Posibles IPv6 link-local (fe80::…)
 */

export interface DetectedIp {
  ip: string;
  family: "IPv4" | "IPv6";
  /** Tipo: "loopback", "private" (LAN), "public", "link-local" */
  type: "loopback" | "private" | "public" | "link-local" | "unknown";
  /** Si la IP es de LAN (10/8, 172.16-31/12, 192.168/16) */
  isLan: boolean;
}

const IPV4_LOOPBACK = /^127\./;
const IPV6_LOOPBACK = /^::1$/;
const IPV6_LINK_LOCAL = /^fe80:/i;
const IPV4_PRIVATE_10 = /^10\./;
const IPV4_PRIVATE_172 = /^172\.(1[6-9]|2\d|3[01])\./;
const IPV4_PRIVATE_192 = /^192\.168\./;

function classifyIpv4(ip: string): DetectedIp["type"] {
  if (IPV4_LOOPBACK.test(ip)) return "loopback";
  if (IPV4_PRIVATE_10.test(ip) || IPV4_PRIVATE_172.test(ip) || IPV4_PRIVATE_192.test(ip)) {
    return "private";
  }
  // Link-local IPv4 (169.254.x.x)
  if (ip.startsWith("169.254.")) return "link-local";
  return "public";
}

function classifyIpv6(ip: string): DetectedIp["type"] {
  if (IPV6_LOOPBACK.test(ip)) return "loopback";
  if (IPV6_LINK_LOCAL.test(ip)) return "link-local";
  return "public";
}

function ipv4IsLan(ip: string): boolean {
  return (
    IPV4_PRIVATE_10.test(ip) ||
    IPV4_PRIVATE_172.test(ip) ||
    IPV4_PRIVATE_192.test(ip)
  );
}

/**
 * Detecta las IPs locales del cliente usando WebRTC.
 * Devuelve una Promise que resuelve con la lista (tarda 100-500ms
 * mientras se descubren los candidatos).
 *
 * Si WebRTC falla o está deshabilitado, devuelve [] sin tirar error.
 */
export function detectLocalIps(timeoutMs = 800): Promise<DetectedIp[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.RTCPeerConnection) {
      resolve([]);
      return;
    }
    const candidates = new Set<string>();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        pc.close();
      } catch {
        // ignore
      }
      const list: DetectedIp[] = [];
      for (const c of candidates) {
        if (c.includes(":")) {
          // IPv6
          const ip = c.split("/")[0] || c;
          list.push({
            ip,
            family: "IPv6",
            type: classifyIpv6(ip),
            isLan: false,
          });
        } else {
          // IPv4
          list.push({
            ip: c,
            family: "IPv4",
            type: classifyIpv4(c),
            isLan: ipv4IsLan(c),
          });
        }
      }
      // Ordenar: LAN primero, luego loopback, luego públicas
      list.sort((a, b) => {
        const score = (x: DetectedIp) =>
          x.isLan ? 0 : x.type === "loopback" ? 1 : x.type === "link-local" ? 2 : 3;
        return score(a) - score(b);
      });
      resolve(list);
    };

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch {
      resolve([]);
      return;
    }
    pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate) {
        const m = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+|[0-9a-fA-F:]+:[0-9a-fA-F:]+)/);
        if (m) candidates.add(m[1]);
      } else if (e.candidate === null) {
        // gathering complete
        finish();
      }
    };
    pc.createDataChannel("");
    pc
      .createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish());

    // Timeout de seguridad
    setTimeout(finish, timeoutMs);
  });
}

/**
 * A partir de una IP de LAN del cliente, genera la lista de
 * IPs candidatas para el servidor (mismo /24, todos los hosts).
 *
 * Por defecto retorna .1 a .254 (254 IPs). Si se quiere un
 * escaneo más rápido, pasar `mode: "fast"` para solo los
 * hosts más comunes.
 *
 * Ej: 192.168.0.42 → ["192.168.0.1", "192.168.0.2", ..., "192.168.0.254"]
 */
export function candidateServerIpsFromClient(
  clientIp: string,
  mode: "fast" | "full" = "full",
): string[] {
  if (!ipv4IsLan(clientIp)) return [];
  const parts = clientIp.split(".");
  if (parts.length !== 4) return [];
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;

  if (mode === "fast") {
    // Hosts comunes donde suele haber servers
    const common = new Set<number>([
      ...Array.from({ length: 20 }, (_, i) => i + 1),
      42, 50, 90, 100,
      ...Array.from({ length: 55 }, (_, i) => 200 + i),
    ]);
    return Array.from(common).map((n) => `${subnet}.${n}`);
  }

  // Modo "full": .1 a .254
  const all: string[] = [];
  for (let i = 1; i <= 254; i++) {
    all.push(`${subnet}.${i}`);
  }
  return all;
}

/**
 * Parsea una subred en formato "X.X.X" o "X.X.X.0/24" y devuelve
 * la base sin la máscara. Devuelve null si no es válida.
 */
export function parseSubnet(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Quitar /24 si está
  const noMask = trimmed.replace(/\/24$/, "").replace(/\/+$/, "");
  // Quitar .0 final si está
  const noHost = noMask.replace(/\.0$/, "");
  // Validar que son 3 octetos
  const parts = noHost.split(".");
  if (parts.length !== 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p) && +p >= 0 && +p <= 255)) return null;
  return noHost;
}

/**
 * Genera la lista de subredes a escanear, basándose en la IP
 * del cliente. Incluye:
 * - La subred del cliente (siempre)
 * - Subredes adyacentes en el mismo /16 (e.g., si cliente está
 *   en 192.168.0.x, agrega .1, .2, .3)
 * - Subredes comunes fijas (10.0.0.x, 172.16.0-12.x, etc.)
 * - Subredes adicionales pasadas por el usuario
 *
 * Devuelve subredes únicas, sin duplicados.
 */
export function candidateSubnetsFromClient(
  clientIp: string,
  customSubnets: string[] = [],
): string[] {
  const set = new Set<string>();

  // 1. Subred del cliente
  const clientParts = clientIp.split(".");
  if (clientParts.length === 4) {
    set.add(`${clientParts[0]}.${clientParts[1]}.${clientParts[2]}`);

    // 2. Subredes adyacentes en el mismo /16 (4 antes + 4 después)
    if (
      clientParts[0] === "192" &&
      clientParts[1] === "168"
    ) {
      const third = +clientParts[2];
      for (let i = Math.max(0, third - 4); i <= Math.min(255, third + 4); i++) {
        if (i !== third) set.add(`192.168.${i}`);
      }
    } else if (clientParts[0] === "10") {
      // 10.0.0.x, 10.0.1.x, 10.0.2.x, ... 10.0.10.x
      const fourth = +clientParts[2];
      for (let i = Math.max(0, fourth - 3); i <= Math.min(255, fourth + 3); i++) {
        set.add(`10.0.${i}`);
      }
    } else if (clientParts[0] === "172" && +clientParts[1] >= 16 && +clientParts[1] <= 31) {
      // 172.16.X.x, 172.17.X.x, 172.18.X.x (algunos segmentos)
      const second = +clientParts[1];
      for (let i = Math.max(16, second - 2); i <= Math.min(31, second + 2); i++) {
        if (i !== second) set.add(`172.${i}.0`);
      }
    }
  }

  // 3. Subredes comunes fijas (por si el cliente está en una subred rara).
  //    Lista balanceada: incluye las subredes más típicas de oficinas,
  //    escuelas y redes corporativas sin ser excesiva. El usuario puede
  //    agregar más con el input "Subredes a escanear".
  const COMMON_SUBNETS = [
    // Hogares y oficinas pequeñas
    "10.0.0", "10.0.1",
    "192.168.0", "192.168.1", "192.168.2",
    // Corporativas y educativas (rango 172.16.X)
    // Incluye las más comunes: 0, 4, 8, 16
    "172.16.0", "172.16.4", "172.16.8", "172.16.16",
    // Otros rangos 172.X
    "172.17.0", "172.18.0",
  ];
  for (const s of COMMON_SUBNETS) set.add(s);

  // 4. Subredes custom del usuario
  for (const c of customSubnets) {
    const parsed = parseSubnet(c);
    if (parsed) set.add(parsed);
  }

  return Array.from(set);
}

/**
 * Genera la lista de IPs a escanear en una lista de subredes.
 *
 * @param subnets  Lista de subredes en formato "X.X.X"
 * @param mode     "fast" (solo IPs comunes) o "full" (todas las 254)
 */
export function ipsFromSubnets(
  subnets: string[],
  mode: "fast" | "full" = "full",
): string[] {
  const allIps: string[] = [];
  for (const subnet of subnets) {
    // subnet ya está en formato "X.X.X"
    if (mode === "fast") {
      // IPs comunes donde suele haber servers:
      // - 1-20: router y hosts bajos
      // - 42: "magic IP" de uso común
      // - 50, 90, 100: servers típicos
      // - 200-254: rango final
      const common = new Set<number>([
        ...Array.from({ length: 20 }, (_, i) => i + 1),
        42, 50, 90, 100,
        ...Array.from({ length: 55 }, (_, i) => 200 + i), // 200-254
      ]);
      for (const c of common) {
        allIps.push(`${subnet}.${c}`);
      }
    } else {
      for (let i = 1; i <= 254; i++) {
        allIps.push(`${subnet}.${i}`);
      }
    }
  }
  return allIps;
}

/**
 * Construye una URL candidata para probar.
 * Si la URL base ya tiene puerto, lo respeta; si no, usa 3000.
 */
export function buildCandidateUrl(ip: string, port = 3000): string {
  return `http://${ip}:${port}`;
}

/**
 * Hace un GET /health rápido (timeout corto) para ver si hay un
 * servidor IMBIO en esa IP. Devuelve true si responde OK.
 */
export async function probeHealth(
  url: string,
  timeoutMs = 1200,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
      mode: "cors",
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = await res.json();
    return body?.ok === true && body?.service === "imbio-server";
  } catch {
    return false;
  }
}

/**
 * Escanea una lista de IPs candidatas y devuelve las URLs donde
 * hay un servidor IMBIO. Usa concurrencia limitada para no saturar
 * la red ni el navegador. La callback `onProgress` (opcional) se
 * llama después de cada probe con (revisadas, total, encontradas).
 *
 * @param ips         Lista de IPs a probar
 * @param port        Puerto a probar (default 3000)
 * @param concurrency Máximo de probes simultáneos (default 30)
 * @param onProgress  Callback de progreso
 */
export async function scanSubnetForServer(
  ips: string[],
  port = 3000,
  concurrency = 30,
  onProgress?: (checked: number, total: number, found: string[]) => void,
): Promise<string[]> {
  const found: string[] = [];
  let checked = 0;
  const total = ips.length;

  // Procesa por chunks
  for (let i = 0; i < ips.length; i += concurrency) {
    const chunk = ips.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((ip) => probeHealth(buildCandidateUrl(ip, port))),
    );
    for (let j = 0; j < chunk.length; j++) {
      if (results[j]) {
        found.push(buildCandidateUrl(chunk[j], port));
      }
    }
    checked += chunk.length;
    onProgress?.(checked, total, [...found]);
  }
  return found;
}
