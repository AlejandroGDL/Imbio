import { PrismaClient, CategoriaTramite, RolUsuario } from "@prisma/client";

const prisma = new PrismaClient();

// =================================================================
// Tipos para la definición de campos dinámicos
// =================================================================

type TipoCampo =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "textarea"
  | "boolean"
  | "currency";

interface CampoTramite {
  key: string;
  label: string;
  tipo: TipoCampo;
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  helpText?: string;
  group?: string;
  showInAuthorization?: boolean; // Si debe aparecer en el doc de autorización
  afectaPrecio?: boolean; // Si entra en el cálculo de precio variable
  default?: string | number | boolean;
}

interface TramiteSeed {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaTramite;
  campos: CampoTramite[];
  precioBase?: number;
  reglaPrecio?: unknown;
  requierePago?: boolean;
  orden: number;
}

// =================================================================
// Definición de los 15 trámites
// =================================================================

const TRAMITES: TramiteSeed[] = [
  // 1. Permiso de quema de horno ladrillera
  {
    codigo: "PERMISO_QUEMA",
    nombre: "Permiso de Quema de Horno Ladrillera",
    descripcion:
      "Permiso para realizar quema controlada en horno ladrillero.",
    categoria: "PERMISO",
    orden: 1,
    precioBase: 250,
    campos: [
      {
        key: "responsable",
        label: "Responsable",
        tipo: "text",
        required: true,
        placeholder: "Nombre completo del responsable",
        showInAuthorization: true,
      },
      {
        key: "nucleoLadrillera",
        label: "Núcleo Ladrillero",
        tipo: "select",
        required: true,
        options: ["Lopez Mateo", "Gamez Orozco", "Las Animas", "Emiliano"],
        showInAuthorization: true,
      },
      {
        key: "coordenadas",
        label: "Coordenadas",
        tipo: "text",
        required: true,
        placeholder: "Lat, Lng o UTM",
        showInAuthorization: true,
      },
      {
        key: "capacidadHorno",
        label: "Capacidad del Horno",
        tipo: "text",
        required: true,
        placeholder: "Ej: 5,000 piezas",
        showInAuthorization: true,
      },
      {
        key: "fechaInicio",
        label: "Fecha de Inicio",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "fechaFin",
        label: "Fecha de Fin",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "horaInicio",
        label: "Hora de Inicio",
        tipo: "time",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "horaFin",
        label: "Hora de Fin",
        tipo: "time",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreTecnicoAutoriza",
        label: "Nombre del Técnico que Autoriza",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
    ],
  },

  // 2. Permiso de poda de árbol
  {
    codigo: "PERMISO_PODA",
    nombre: "Permiso de Poda de Árbol",
    descripcion: "Autorización para podar un árbol.",
    categoria: "PERMISO",
    orden: 2,
    campos: [
      {
        key: "nombreSolicitante",
        label: "Nombre del Solicitante",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "direccionArbol",
        label: "Dirección del Árbol",
        tipo: "text",
        required: true,
        placeholder: "Calle, número, colonia",
        showInAuthorization: true,
      },
      {
        key: "nombreComun",
        label: "Nombre Común",
        tipo: "select",
        required: true,
        // Opciones cargadas dinámicamente en el frontend desde
        // src/data/arboles-pabellon.ts (los 20 más comunes en
        // Pabellón de Arteaga). El nombre científico se autorrellena.
        options: [
          "Fresno",
          "Pirul",
          "Álamo",
          "Álamo blanco",
          "Huizache",
          "Acacia",
          "Laurel de la India",
          "Bugambilia",
          "Troeno",
          "Rosa Laurel",
          "Cedro Blanco",
          "Pino Piñonero",
          "Palma Abanico",
          "Palma Datilera",
          "Lechero rojo",
          "Guache",
          "Aralia",
          "Crespón",
          "Ciruelo mexicano",
          "Palo blanco",
          "Mezquite",
          "Yuca",
          "Sabino",
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
        required: true,
        min: 0,
        step: 0.1,
        helpText: "Obligatorio: determina el precio (1.5× VVUMA si ≥3m, 0.5× VVUMA si <3m)",
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
        afectaPrecio: true,
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
        key: "nombreTecnicoAutoriza",
        label: "Nombre del Técnico que Realizó",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
    ],
    reglaPrecio: {
      tipo: "rango",
      campo: "altura",
      rangos: [
        { hasta: 5, precio: 150 },
        { hasta: 10, precio: 300 },
        { hasta: 15, precio: 500 },
        { hasta: 1000, precio: 800 },
      ],
    },
  },

  // 3. Permiso de derribo de árbol
  {
    codigo: "PERMISO_DERRIBO",
    nombre: "Permiso de Derribo de Árbol",
    descripcion: "Autorización para derribar un árbol.",
    categoria: "PERMISO",
    orden: 3,
    campos: [
      {
        key: "nombreSolicitante",
        label: "Nombre del Solicitante",
        tipo: "text",
        required: true,
        // Se autorrellena con el nombre del ciudadano al autorizar.
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
        // Especie del árbol — define la tarifa y el factor de forma
        // sugerido. Ver /Users/andro/Downloads/CalculadoraIMBIO.html
        // (sección 1, Permiso de derribo) y el array `factoresUrbanos`
        // del JS para el detalle de cada especie.
        // El valor guardado es la key (mezquite, huizache, etc.) y
        // el label visible incluye el nombre común + científico.
        //
        // Grupos de tarifa (espejo del HTML):
        //   Tarifa I   (30 vvuma/m³): mezquite, huizache, sabino, yuca
        //   Tarifa II  ( 5 vvuma/m³): pirul, pino
        //   Tarifa III ( 8 vvuma/m³, mín 6 vvuma): el resto
        key: "especie",
        label: "Especie del árbol",
        tipo: "select",
        required: true,
        options: [
          // Tarifa I
          "mezquite|Mezquite (Prosopis laevigata)",
          "huizache|Huizache (Acacia spp.)",
          "sabino|Sabino (Taxodium mucronatum)",
          "yuca|Yuca (Yucca spp.)",
          // Tarifa II
          "pirul|Pirul (Schinus molle)",
          "pino|Pino (Pinus spp.)",
          // Tarifa III — Otras Especies (factores de forma del HTML)
          "eucalipto|Eucalipto (Eucalyptus spp.)",
          "trueno|Trueno (Ligustrum lucidum)",
          "pata_vaca|Pata de vaca (Bauhinia variegata)",
          "fresno|Fresno (Fraxinus uhdei)",
          "jacaranda|Jacaranda (Jacaranda mimosifolia)",
          "ficus|Ficus (Ficus benjamina / nitida)",
          "cedro_blanco|Cedro blanco (Cupressus lindleyi)",
          "paraiso|Árbol del paraíso (Melia azedarach)",
          "colorin|Colorín / Zompantle (Erythrina americana)",
          "sauce|Sauce llorón (Salix babylonica)",
          // Opción genérica para "cualquier otra no listada"
          "otra|Otra especie",
        ],
        helpText:
          "Define la tarifa (I, II o III) y el factor de forma sugerido",
        showInAuthorization: true,
        afectaPrecio: true,
      },
      {
        key: "nombreCientifico",
        label: "Nombre Científico",
        tipo: "text",
        required: false,
        // Se autorrellena al elegir la especie, pero el operador
        // puede corregirlo si lo necesita.
        showInAuthorization: true,
      },
      {
        // Perímetro a la altura del pecho (CAP) en cm.
        // Se usa con altura + factor de forma para calcular el
        // volumen del fuste y la biomasa total.
        key: "perimetro",
        label: "Perímetro (CAP) en cm",
        tipo: "number",
        required: true,
        min: 1,
        step: 0.1,
        placeholder: "Ej. 110",
        helpText: "Cinta métrica estándar",
        showInAuthorization: true,
        afectaPrecio: true,
      },
      {
        key: "altura",
        label: "Altura del árbol (m)",
        tipo: "number",
        required: true,
        min: 0.1,
        step: 0.01,
        placeholder: "Ej. 8.5",
        showInAuthorization: true,
        afectaPrecio: true,
      },
      {
        // Factor de forma (f) — depende de la especie. El frontend
        // muestra chips de sugerencias; el operador puede
        // sobrescribirlo.
        key: "factorForma",
        label: "Factor de forma (f)",
        tipo: "number",
        required: true,
        min: 0.1,
        max: 1,
        step: 0.01,
        default: 0.7,
        helpText: "Depende de la especie. Se autorrellena al elegir.",
        showInAuthorization: false,
        afectaPrecio: true,
      },
      {
        key: "dap",
        label: "DAP (cm)",
        tipo: "number",
        required: false,
        min: 0,
        step: 0.1,
        helpText: "Opcional",
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
    ],
    reglaPrecio: {
      tipo: "rango",
      campo: "altura",
      rangos: [
        { hasta: 5, precio: 400 },
        { hasta: 10, precio: 700 },
        { hasta: 15, precio: 1100 },
        { hasta: 1000, precio: 1600 },
      ],
    },
  },

  // 4. Servicio de poda de árbol
  {
    codigo: "SERVICIO_PODA",
    nombre: "Servicio de Poda de Árbol",
    descripcion: "Servicio prestado por el municipio para podar un árbol.",
    categoria: "SERVICIO",
    orden: 4,
    campos: [
      {
        key: "nombreSolicitante",
        label: "Nombre del Solicitante",
        tipo: "text",
        required: true,
        // Se autorrellena con el nombre del ciudadano al autorizar.
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
        // Opciones cargadas dinámicamente en el frontend desde
        // src/data/arboles-pabellon.ts. El nombre científico se
        // autorrellena al elegir.
        options: [
          "Fresno",
          "Pirul",
          "Álamo",
          "Álamo blanco",
          "Huizache",
          "Acacia",
          "Laurel de la India",
          "Bugambilia",
          "Troeno",
          "Rosa Laurel",
          "Cedro Blanco",
          "Pino Piñonero",
          "Palma Abanico",
          "Palma Datilera",
          "Lechero rojo",
          "Guache",
          "Aralia",
          "Crespón",
          "Ciruelo mexicano",
          "Palo blanco",
          "Mezquite",
          "Yuca",
          "Sabino",
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
        default: 30,
        showInAuthorization: true,
      },
      {
        key: "tipoPoda",
        label: "Tipo de Poda",
        tipo: "select",
        required: true,
        options: ["Limpieza", "Formación", "Aclareo", "Faldeado"],
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
    ],
    reglaPrecio: {
      tipo: "compuesto",
      reglas: [
        {
          campo: "altura",
          tipo: "rango",
          rangos: [
            { hasta: 5, precio: 200 },
            { hasta: 10, precio: 400 },
            { hasta: 15, precio: 700 },
            { hasta: 1000, precio: 1100 },
          ],
        },
        {
          campo: "tipoPoda",
          tipo: "factor",
          valores: { Limpieza: 1, Formación: 1.2, Aclareo: 1.3, Faldeado: 1.5 },
        },
      ],
    },
  },

  // 5. Servicio de derribo de árbol
  {
    codigo: "SERVICIO_DERRIBO",
    nombre: "Servicio de Derribo de Árbol",
    descripcion: "Servicio prestado por el municipio para derribar un árbol.",
    categoria: "SERVICIO",
    orden: 5,
    campos: [
      {
        key: "nombreSolicitante",
        label: "Nombre del Solicitante",
        tipo: "text",
        required: true,
        // Se autorrellena con el nombre del ciudadano al autorizar.
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
        // Opciones cargadas dinámicamente en el frontend desde
        // src/data/arboles-pabellon.ts. El nombre científico se
        // autorrellena al elegir.
        options: [
          "Fresno",
          "Pirul",
          "Álamo",
          "Álamo blanco",
          "Huizache",
          "Acacia",
          "Laurel de la India",
          "Bugambilia",
          "Troeno",
          "Rosa Laurel",
          "Cedro Blanco",
          "Pino Piñonero",
          "Palma Abanico",
          "Palma Datilera",
          "Lechero rojo",
          "Guache",
          "Aralia",
          "Crespón",
          "Ciruelo mexicano",
          "Palo blanco",
          "Mezquite",
          "Yuca",
          "Sabino",
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
        default: 30,
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
    ],
    reglaPrecio: {
      tipo: "rango",
      campo: "altura",
      rangos: [
        { hasta: 5, precio: 600 },
        { hasta: 10, precio: 1200 },
        { hasta: 15, precio: 2000 },
        { hasta: 1000, precio: 3000 },
      ],
    },
  },

  // 6. Permiso de traslado de leña
  {
    codigo: "PERMISO_TRASLADO_LENA",
    nombre: "Permiso de Traslado de Leña",
    descripcion: "Permiso para transportar leña.",
    categoria: "PERMISO",
    orden: 6,
    precioBase: 120,
    campos: [
      {
        key: "nombreResponsable",
        label: "Nombre del Responsable",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "tipoVehiculo",
        label: "Tipo de Vehículo",
        tipo: "select",
        required: true,
        options: [
          "Camioneta",
          "Camión",
          "Camión de carga",
          "Pickup",
          "Tractocamión",
          "Remolque",
          "Otro",
        ],
        showInAuthorization: true,
      },
      {
        key: "marca",
        label: "Marca",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "modelo",
        label: "Modelo",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "color",
        label: "Color",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "placas",
        label: "Placas",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "origen",
        label: "Origen",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "destino",
        label: "Destino",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "estadoMaterial",
        label: "Estado del Material",
        tipo: "select",
        required: true,
        options: ["Verde", "Seco", "Mixto"],
        showInAuthorization: true,
      },
      {
        key: "volumenPeso",
        label: "Volumen o Peso",
        tipo: "text",
        required: true,
        placeholder: "Ej: 2 m³ o 500 kg",
        showInAuthorization: true,
      },
      {
        key: "especie",
        label: "Especie",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "referenciaOrigen",
        label: "Referencia de Origen (folio poda/derribo)",
        tipo: "text",
        required: false,
        helpText: "Folio del permiso que originó la leña",
        showInAuthorization: true,
      },
      {
        key: "causalGeneracion",
        label: "Causal de Generación",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "vigencia",
        label: "Vigencia",
        tipo: "text",
        required: true,
        default: "24 horas",
        showInAuthorization: true,
      },
      {
        key: "rutaDefinida",
        label: "Ruta Definida",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "usoMaterial",
        label: "Uso del Material",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreTecnicoAutoriza",
        label: "Nombre del Técnico que Autoriza",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 7. Servicio de pipa de agua tratada rural
  {
    codigo: "SERVICIO_PIPA_RURAL",
    nombre: "Servicio de Pipa de Agua Tratada (Rural)",
    descripcion: "Suministro de agua tratada mediante pipa en zona rural.",
    categoria: "SERVICIO",
    orden: 7,
    precioBase: 350,
    campos: [
      {
        key: "nombreSolicitante",
        label: "Nombre del Solicitante",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "telefono",
        label: "Teléfono",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "domicilio",
        label: "Domicilio / Comunidad",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "cantidadLitros",
        label: "Cantidad (litros)",
        tipo: "number",
        required: true,
        min: 0,
        showInAuthorization: true,
        afectaPrecio: true,
      },
      {
        key: "fechaServicio",
        label: "Fecha del Servicio",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "motivo",
        label: "Motivo de la Solicitud",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 8. Servicio de pipa de agua tratada urbana
  {
    codigo: "SERVICIO_PIPA_URBANA",
    nombre: "Servicio de Pipa de Agua Tratada (Urbana)",
    descripcion: "Suministro de agua tratada mediante pipa en zona urbana.",
    categoria: "SERVICIO",
    orden: 8,
    precioBase: 280,
    campos: [
      {
        key: "nombreSolicitante",
        label: "Nombre del Solicitante",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "telefono",
        label: "Teléfono",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "domicilio",
        label: "Domicilio",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "cantidadLitros",
        label: "Cantidad (litros)",
        tipo: "number",
        required: true,
        min: 0,
        showInAuthorization: true,
        afectaPrecio: true,
      },
      {
        key: "fechaServicio",
        label: "Fecha del Servicio",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "motivo",
        label: "Motivo de la Solicitud",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 9. Esterilización mascota
  {
    codigo: "ESTERILIZACION_MASCOTA",
    nombre: "Esterilización de Mascota",
    descripcion: "Servicio de esterilización canina o felina.",
    categoria: "SERVICIO",
    orden: 9,
    precioBase: 200,
    campos: [
      {
        key: "nombreDueno",
        label: "Nombre del Dueño",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "telefono",
        label: "Teléfono",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "direccion",
        label: "Dirección",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreMascota",
        label: "Nombre de la Mascota",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "especie",
        label: "Especie",
        tipo: "select",
        required: true,
        options: ["Canino", "Felino", "Otro"],
        showInAuthorization: true,
      },
      {
        key: "raza",
        label: "Raza",
        tipo: "text",
        required: false,
        showInAuthorization: true,
      },
      {
        key: "sexo",
        label: "Sexo",
        tipo: "select",
        required: true,
        options: ["Macho", "Hembra"],
        showInAuthorization: true,
      },
      {
        key: "edad",
        label: "Edad (años)",
        tipo: "number",
        required: true,
        min: 0,
        step: 0.5,
        showInAuthorization: true,
      },
      {
        key: "peso",
        label: "Peso (kg)",
        tipo: "number",
        required: true,
        min: 0,
        step: 0.1,
        showInAuthorization: true,
      },
      {
        key: "fechaServicio",
        label: "Fecha del Servicio",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 10. Eutanasia mascota
  {
    codigo: "EUTANASIA_MASCOTA",
    nombre: "Eutanasia de Mascota",
    descripcion: "Procedimiento de eutanasia para mascota.",
    categoria: "SERVICIO",
    orden: 10,
    campos: [
      {
        key: "nombreDueno",
        label: "Nombre del Dueño",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "telefono",
        label: "Teléfono",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "direccion",
        label: "Dirección",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreMascota",
        label: "Nombre de la Mascota",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "especie",
        label: "Especie",
        tipo: "select",
        required: true,
        options: ["Canino", "Felino", "Otro"],
        showInAuthorization: true,
      },
      {
        key: "sexo",
        label: "Sexo",
        tipo: "select",
        required: true,
        options: ["Macho", "Hembra"],
        showInAuthorization: true,
      },
      {
        key: "edad",
        label: "Edad (años)",
        tipo: "number",
        required: true,
        min: 0,
        step: 0.5,
        showInAuthorization: true,
      },
      {
        key: "motivo",
        label: "Motivo",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "dictamen",
        label: "Dictamen",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "fechaServicio",
        label: "Fecha del Servicio",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreTecnicoAutoriza",
        label: "Nombre del Técnico que Autoriza",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 11. Resguardo de mascota
  {
    codigo: "RESGUARDO_MASCOTA",
    nombre: "Resguardo de Mascota",
    descripcion: "Resguardo temporal de mascota en centro de control animal.",
    categoria: "SERVICIO",
    orden: 11,
    precioBase: 50,
    campos: [
      {
        key: "nombreReportante",
        label: "Nombre del Reportante",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "telefono",
        label: "Teléfono",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "direccion",
        label: "Dirección donde se recogió",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "descripcionMascota",
        label: "Descripción de la Mascota",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "especie",
        label: "Especie",
        tipo: "select",
        required: true,
        options: ["Canino", "Felino", "Otro"],
        showInAuthorization: true,
      },
      {
        key: "sexo",
        label: "Sexo (aparente)",
        tipo: "select",
        required: false,
        options: ["Macho", "Hembra", "Desconocido"],
        showInAuthorization: true,
      },
      {
        key: "fechaResguardo",
        label: "Fecha de Resguardo",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "motivo",
        label: "Motivo del Resguardo",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 12. Limpieza de lote baldío
  {
    codigo: "LIMPIEZA_LOTE",
    nombre: "Limpieza de Lote Baldío",
    descripcion: "Servicio de limpieza de lote baldío.",
    categoria: "SERVICIO",
    orden: 12,
    campos: [
      {
        key: "direccion",
        label: "Dirección del Lote",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "coordenadas",
        label: "Coordenadas",
        tipo: "text",
        required: false,
        showInAuthorization: true,
      },
      {
        key: "propietario",
        label: "Propietario",
        tipo: "text",
        required: false,
        showInAuthorization: true,
      },
      {
        key: "nombreSolicitante",
        label: "Nombre del Solicitante",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "telefono",
        label: "Teléfono",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "fechaServicio",
        label: "Fecha del Servicio",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 13. Uso de contenedores para residuos sólidos
  {
    codigo: "USO_CONTENEDORES",
    nombre: "Uso de Contenedores para Residuos Sólidos",
    descripcion: "Permiso de uso de contenedores de residuos sólidos.",
    categoria: "PERMISO",
    orden: 13,
    campos: [
      {
        // Selector de tipo de generador. El factor (multiplicador de VVUMA)
        // está hardcodeado en el frontend (src/lib/precios.ts) y se aplica
        // junto con `mesesPermiso` para calcular el precio del permiso:
        //   precio = factor(tipoGenerador) × VVUMA × mesesPermiso
        // Ver `TIPOS_GENERADOR_CONTENEDOR` y `factorTipoGeneradorContenedor`.
        key: "tipoGenerador",
        label: "Tipo de Generador",
        tipo: "select",
        required: true,
        options: [
          "Micro-generador (1-40 kg/semana)",
          "Pequeño generador (40-80 kg/semana)",
          "Pequeño generador (80-150 kg/semana)",
          "Pequeño generador (150-180 kg/semana)",
          "Pequeño generador (180-200 kg/semana)",
        ],
        showInAuthorization: true,
      },
      {
        // Cantidad de meses por los que se otorga el permiso.
        // El precio se calcula como factor × VVUMA × meses.
        // La fecha de vencimiento en la autorización se calcula como
        // fechaEmision + mesesPermiso.
        key: "mesesPermiso",
        label: "Cantidad de meses del permiso",
        tipo: "number",
        required: true,
        min: 1,
        max: 60,
        default: 12,
        placeholder: "Ej: 12 (un año)",
        showInAuthorization: true,
        afectaPrecio: true,
      },
      {
        key: "nombreRazonSocial",
        label: "Nombre o Razón Social",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "rfc",
        label: "RFC",
        tipo: "text",
        required: false,
        showInAuthorization: true,
      },
      {
        key: "ubicacionEstablecimiento",
        label: "Ubicación del Establecimiento",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "vigenciaFiscal",
        label: "Vigencia Fiscal",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "volumenAutorizado",
        label: "Volumen Autorizado",
        tipo: "text",
        required: true,
        placeholder: "Ej: 2 toneladas/mes",
        showInAuthorization: true,
        afectaPrecio: true,
      },
      {
        key: "ubicacionContenedor",
        label: "Ubicación del Contenedor",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreTecnicoAutoriza",
        label: "Nombre del Técnico que Autoriza",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 14. Captura y aseguramiento de mascotas
  {
    codigo: "CAPTURA_MASCOTAS",
    nombre: "Captura y Aseguramiento de Mascotas",
    descripcion: "Captura de mascota en vía pública o por reporte.",
    categoria: "SERVICIO",
    orden: 14,
    campos: [
      {
        key: "direccion",
        label: "Dirección",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "descripcionMascota",
        label: "Descripción de la Mascota",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "especie",
        label: "Especie",
        tipo: "select",
        required: true,
        options: ["Canino", "Felino", "Otro"],
        showInAuthorization: true,
      },
      {
        key: "sexo",
        label: "Sexo (aparente)",
        tipo: "select",
        required: false,
        options: ["Macho", "Hembra", "Desconocido"],
        showInAuthorization: true,
      },
      {
        key: "motivo",
        label: "Motivo de la Captura",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "fechaCaptura",
        label: "Fecha de Captura",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreTecnicoAutoriza",
        label: "Nombre del Técnico que Autoriza",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },

  // 15. Sanción de infección ambiental
  {
    codigo: "SANCION_INFECCION",
    nombre: "Sanción de Infección Ambiental",
    descripcion: "Sanción por contaminación o infección ambiental.",
    categoria: "SANCION",
    orden: 15,
    campos: [
      {
        key: "direccion",
        label: "Dirección",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "nombreInfractor",
        label: "Nombre del Infractor",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "tipoInfraccion",
        label: "Tipo de Infracción",
        tipo: "textarea",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "montoMulta",
        label: "Monto de la Multa (MXN)",
        tipo: "currency",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "fecha",
        label: "Fecha",
        tipo: "date",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "fundamentoLegal",
        label: "Fundamento Legal",
        tipo: "textarea",
        required: false,
        showInAuthorization: true,
      },
      {
        key: "nombreTecnicoAutoriza",
        label: "Nombre del Técnico que Autoriza",
        tipo: "text",
        required: true,
        showInAuthorization: true,
      },
      {
        key: "observaciones",
        label: "Observaciones",
        tipo: "textarea",
        required: false,
        showInAuthorization: false,
      },
    ],
  },
];

// =================================================================
// Función principal del seed (idempotente)
// =================================================================

/**
 * Devuelve true si la base de datos está "vacía" (sin trámites
 * ni usuario admin). Se usa para decidir si auto-sembrar al
 * primer arranque del servidor.
 */
export async function isDbEmpty(): Promise<boolean> {
  const [tramiteCount, adminCount, configCount] = await Promise.all([
    prisma.tramite.count(),
    prisma.usuario.count({ where: { username: "admin" } }),
    prisma.configuracion.count(),
  ]);
  return tramiteCount === 0 && adminCount === 0 && configCount === 0;
}

/**
 * Ejecuta el seed completo. Es idempotente: puede correr varias
 * veces sin duplicar datos. Usar upsert donde corresponde y
 * "create si count==0" donde no se puede upsert.
 */
export async function runSeed(log = true): Promise<void> {
  const log_ = log ? console.log : () => {};

  log_("🌱 Iniciando seed de IMBIO...\n");

  // 1. Configuración inicial (singleton)
  log_("⚙️  Insertando configuración inicial...");
  await prisma.configuracion.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  log_("   ✓ Configuración lista\n");

  // 2. Catálogo de trámites
  log_(`📋 Insertando ${TRAMITES.length} trámites al catálogo...`);
  for (const t of TRAMITES) {
    await prisma.tramite.upsert({
      where: { codigo: t.codigo },
      create: {
        codigo: t.codigo,
        nombre: t.nombre,
        descripcion: t.descripcion,
        categoria: t.categoria,
        campos: t.campos as any,
        precioBase: t.precioBase,
        reglaPrecio: (t.reglaPrecio as any) ?? undefined,
        requierePago: t.requierePago ?? true,
        orden: t.orden,
        activo: true,
      },
      update: {
        nombre: t.nombre,
        descripcion: t.descripcion,
        categoria: t.categoria,
        campos: t.campos as any,
        precioBase: t.precioBase,
        reglaPrecio: (t.reglaPrecio as any) ?? undefined,
        requierePago: t.requierePago ?? true,
        orden: t.orden,
        activo: true,
      },
    });
    log_(`   ✓ ${t.codigo.padEnd(28)} → ${t.nombre}`);
  }
  log_("");

  // 3. Técnico de ejemplo
  log_("👤 Insertando técnico de ejemplo...");
  const tecnicoCount = await prisma.tecnico.count();
  if (tecnicoCount === 0) {
    await prisma.tecnico.create({
      data: {
        nombre: "Técnico de Guardia",
        cargo: "Inspector Ambiental",
        departamento: "Inspección y Vigilancia",
        email: "inspeccion@imbio.gob.mx",
        activo: true,
      },
    });
    log_("   ✓ Técnico de Guardia creado");
  } else {
    log_(`   · Ya hay ${tecnicoCount} técnico(s) registrado(s)`);
  }
  log_("");

  // 4. Usuario administrador inicial
  log_("🔐 Insertando usuario administrador inicial...");
  const adminCount = await prisma.usuario.count({
    where: { username: "admin" },
  });
  if (adminCount === 0) {
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash("admin123", 12);
    await prisma.usuario.create({
      data: {
        username: "admin",
        passwordHash,
        nombre: "Administrador",
        email: "admin@imbio.gob.mx",
        rol: RolUsuario.ADMIN,
        activo: true,
      },
    });
    log_("   ✓ Usuario 'admin' creado (password: admin123 — CAMBIAR)");
  } else {
    log_(`   · Ya existe el usuario 'admin' (no se modifica)`);
  }
  log_("");

  log_("✅ Seed completado.");
  log_("");
  const counts = {
    tramites: await prisma.tramite.count(),
    config: await prisma.configuracion.count(),
    tecnicos: await prisma.tecnico.count(),
    usuarios: await prisma.usuario.count(),
  };
  log_(`   Trámites:  ${counts.tramites}`);
  log_(`   Técnicos:  ${counts.tecnicos}`);
  log_(`   Usuarios:  ${counts.usuarios}`);
  log_(`   Config:    ${counts.config}`);
}

// =================================================================
// Auto-seed al primer arranque
// =================================================================
/**
 * Si la base de datos está vacía, corre el seed automáticamente.
 * Pensado para llamarse al iniciar el backend en producción
 * (cuando se instala en una PC nueva).
 *
 * - Si isDbEmpty() === true → corre runSeed()
 * - Si ya hay datos → no hace nada
 * - Si falla → log error pero NO tira el servidor
 */
export async function autoSeedIfEmpty(): Promise<"seeded" | "skipped" | "failed"> {
  try {
    const empty = await isDbEmpty();
    if (!empty) return "skipped";
    console.log(
      "\n🌱 Base de datos vacía detectada. Ejecutando seed inicial automáticamente...\n",
    );
    await runSeed();
    console.log(
      "\n✅ Seed inicial completado. El servidor está listo.\n" +
        "   Usuario admin por defecto: admin / admin123 (CAMBIAR en el primer login).\n",
    );
    return "seeded";
  } catch (err) {
    console.error("❌ Error en auto-seed (continuando sin él):", err);
    return "failed";
  }
}

// =================================================================
// Ejecución como script (npm run db:seed)
// =================================================================
async function main() {
  await runSeed(true);
}

// Solo se ejecuta como script cuando se invoca directamente
// (npm run db:seed), NO cuando se importa desde server.ts.
const isDirectInvocation = (() => {
  try {
    // En CommonJS, require.main === module
    if (typeof require !== "undefined" && require.main === module) return true;
  } catch {
    // ESM no tiene require.main
  }
  // En ESM, verificamos si el archivo es el "main" del proceso
  // comparando con process.argv[1]
  try {
    if (typeof process !== "undefined" && process.argv?.[1]) {
      const arg1 = process.argv[1];
      if (arg1.endsWith("prisma/seed.ts") || arg1.endsWith("seed.ts")) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
})();

if (isDirectInvocation) {
  main()
    .catch((e) => {
      console.error("❌ Error en seed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
