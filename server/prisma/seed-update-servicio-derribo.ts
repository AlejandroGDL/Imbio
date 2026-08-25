/**
 * Script one-off para actualizar los `campos` del trámite SERVICIO_DERRIBO
 * con la nueva lista de 11 campos.
 */
import { prisma } from "../src/prisma";

const NUEVOS_CAMPOS = [
  {
    key: "nombreSolicitante",
    label: "Nombre del Solicitante",
    tipo: "text",
    required: true,
    showInAuthorization: true,
  },
  {
    key: "ubicacionArbol",
    label: "Ubicación del árbol",
    tipo: "text",
    required: true,
    placeholder: "Calle, número, colonia o coordenadas",
    showInAuthorization: true,
  },
  {
    key: "nombreComun",
    label: "Nombre Común",
    tipo: "select",
    required: true,
    options: [
      "Fresno","Pirul","Álamo","Álamo blanco","Huizache","Acacia",
      "Laurel de la India","Bugambilia","Troeno","Rosa Laurel",
      "Cedro Blanco","Pino Piñonero","Palma Abanico","Palma Datilera",
      "Lechero rojo","Guache","Aralia","Crespón","Ciruelo mexicano",
      "Palo blanco","Mezquite","Yuca","Sabino",
    ],
    showInAuthorization: true,
  },
  {
    key: "nombreCientifico",
    label: "Nombre Científico",
    tipo: "text",
    required: true,
    showInAuthorization: true,
  },
  {
    key: "altura",
    label: "Altura (m)",
    tipo: "number",
    required: false,
    min: 0,
    step: 0.1,
    showInAuthorization: true,
    afectaPrecio: true,
  },
  {
    key: "dap",
    label: "DAP (cm)",
    tipo: "number",
    required: false,
    min: 0,
    step: 0.1,
    showInAuthorization: true,
  },
  {
    key: "diametroCopa",
    label: "Diámetro de Copa (m)",
    tipo: "number",
    required: false,
    min: 0,
    step: 0.1,
    showInAuthorization: true,
  },
  {
    key: "estadoFitosanitario",
    label: "Estado Fitosanitario",
    tipo: "select",
    required: false,
    options: ["Bueno", "Regular", "Malo", "Muerto"],
    showInAuthorization: true,
  },
  {
    key: "causal",
    label: "Causal",
    tipo: "text",
    required: true,
    showInAuthorization: true,
  },
  {
    key: "plazoEjecucion",
    label: "Plazo de Ejecución (días)",
    tipo: "number",
    required: true,
    min: 1,
    showInAuthorization: true,
  },
  {
    key: "nivelRiesgo",
    label: "Nivel de Riesgo",
    tipo: "select",
    required: true,
    options: ["Bajo", "Medio", "Alto"],
    showInAuthorization: true,
    afectaPrecio: true,
  },
  {
    key: "nombreTecnicoAutoriza",
    label: "Nombre del Técnico que Realizó",
    tipo: "text",
    required: true,
    showInAuthorization: true,
  },
];

async function main() {
  const result = await prisma.tramite.updateMany({
    where: { codigo: "SERVICIO_DERRIBO" },
    data: { campos: NUEVOS_CAMPOS as any },
  });
  console.log(`✓ Actualizado SERVICIO_DERRIBO (${result.count} fila(s))`);
  console.log(`  ${NUEVOS_CAMPOS.length} campos nuevos aplicados`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
