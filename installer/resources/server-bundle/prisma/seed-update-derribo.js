/**
 * Script one-off para actualizar los `campos` del trámite PERMISO_DERRIBO
 * en la BD con la nueva lista de 13 campos.
 *
 * Equivalente a correr el seed de nuevo, pero quirúrgico: sólo toca
 * PERMISO_DERRIBO y deja los demás trámites como están.
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
        key: "coordenadas",
        label: "Coordenadas del árbol",
        tipo: "text",
        required: true,
        placeholder: "Coordenadas UTM (WGS84) o dirección exacta",
        showInAuthorization: true,
    },
    {
        key: "nombreComun",
        label: "Nombre Común",
        tipo: "select",
        required: true,
        options: [
            "Fresno", "Pirul", "Álamo", "Álamo blanco", "Huizache", "Acacia",
            "Laurel de la India", "Bugambilia", "Troeno", "Rosa Laurel",
            "Cedro Blanco", "Pino Piñonero", "Palma Abanico", "Palma Datilera",
            "Lechero rojo", "Guache", "Aralia", "Crespón", "Ciruelo mexicano", "Palo blanco",
        ],
        helpText: "Al elegir, se autorrellena el Nombre Científico",
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
        helpText: "Opcional",
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
        helpText: "Diámetro a la altura del pecho (opcional)",
        showInAuthorization: true,
    },
    {
        key: "diametroCopa",
        label: "Diámetro de Copa (m)",
        tipo: "number",
        required: false,
        min: 0,
        step: 0.1,
        helpText: "Opcional",
        showInAuthorization: true,
    },
    {
        key: "estadoFitosanitario",
        label: "Estado Fitosanitario",
        tipo: "select",
        required: false,
        options: ["Bueno", "Regular", "Malo", "Muerto"],
        helpText: "Opcional",
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
        key: "nivelRiesgo",
        label: "Nivel de Riesgo",
        tipo: "select",
        required: true,
        options: ["Bajo", "Medio", "Alto"],
        showInAuthorization: true,
    },
    {
        key: "vigenciaPermiso",
        label: "Vigencia del Permiso (días)",
        tipo: "number",
        required: true,
        min: 1,
        default: 30,
        helpText: "Por defecto 30 días",
        showInAuthorization: true,
    },
    {
        key: "cantidadEspeciesReponer",
        label: "Cantidad de Especies a Reponer",
        tipo: "number",
        required: false,
        min: 0,
        helpText: "Opcional — puede no aplicar",
        showInAuthorization: true,
    },
    {
        key: "especiesSugeridas",
        label: "Especies Sugeridas",
        tipo: "text",
        required: false,
        placeholder: "Opcional — puede no aplicar",
        helpText: "Opcional — puede no aplicar",
        showInAuthorization: true,
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
        where: { codigo: "PERMISO_DERRIBO" },
        data: { campos: NUEVOS_CAMPOS },
    });
    console.log(`✓ Actualizado PERMISO_DERRIBO (${result.count} fila(s))`);
    console.log(`  ${NUEVOS_CAMPOS.length} campos nuevos aplicados`);
}
main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed-update-derribo.js.map