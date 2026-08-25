/**
 * Árboles comunes en el Municipio de Pabellón de Arteaga, Aguascalientes.
 *
 * Fuentes:
 * - Gobierno de Aguascalientes (SEMADESU): "Árboles adecuados para banquetas
 *   y jardines en el Municipio de Aguascalientes"
 * - Sierra de Arteaga: "Dirección de Conservación" (SMA.gob.mx)
 * - SEMARNAT/INE: Listado de árboles urbanos
 *
 * Lista curada con los 20 árboles más frecuentes en la zona urbana
 * de Pabellón de Arteaga.
 */
export interface Arbol {
  nombreComun: string;
  nombreCientifico: string;
}

export const ARBOLES_PABELLON: Arbol[] = [
  { nombreComun: "Fresno", nombreCientifico: "Fraxinus uhdei" },
  { nombreComun: "Pirul", nombreCientifico: "Schinus molle" },
  { nombreComun: "Álamo", nombreCientifico: "Platanus mexicana" },
  { nombreComun: "Álamo blanco", nombreCientifico: "Populus alba" },
  { nombreComun: "Huizache", nombreCientifico: "Acacia farnesiana" },
  { nombreComun: "Acacia", nombreCientifico: "Acacia retinodes" },
  { nombreComun: "Laurel de la India", nombreCientifico: "Ficus microcarpa" },
  { nombreComun: "Bugambilia", nombreCientifico: "Bougainvillea spectabilis" },
  { nombreComun: "Troeno", nombreCientifico: "Ligustrum japonicum" },
  { nombreComun: "Rosa Laurel", nombreCientifico: "Nerium oleander" },
  { nombreComun: "Cedro Blanco", nombreCientifico: "Cupressus lusitanica" },
  { nombreComun: "Pino Piñonero", nombreCientifico: "Pinus cembroides" },
  { nombreComun: "Palma Abanico", nombreCientifico: "Washingtonia filifera" },
  { nombreComun: "Palma Datilera", nombreCientifico: "Phoenix dactylifera" },
  { nombreComun: "Lechero rojo", nombreCientifico: "Euphorbia cotinifolia" },
  { nombreComun: "Guache", nombreCientifico: "Leucaena leucocephala" },
  { nombreComun: "Aralia", nombreCientifico: "Schefflera actinophylla" },
  { nombreComun: "Crespón / Astronómica", nombreCientifico: "Lagerstroemia indica" },
  { nombreComun: "Ciruelo mexicano", nombreCientifico: "Spondias purpurea" },
  { nombreComun: "Palo blanco", nombreCientifico: "Ehretia anacua" },
  { nombreComun: "Mezquite", nombreCientifico: "Prosopis laevigata" },
  { nombreComun: "Yuca", nombreCientifico: "Yucca filifera" },
  { nombreComun: "Sabino", nombreCientifico: "Taxodium mucronatum" },
];

/**
 * Busca el nombre científico a partir del nombre común.
 * Devuelve undefined si no se encuentra.
 */
export function buscarCientifico(nombreComun: string): string | undefined {
  const match = ARBOLES_PABELLON.find(
    (a) => a.nombreComun.toLowerCase() === nombreComun.toLowerCase(),
  );
  return match?.nombreCientifico;
}
