import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Briefcase,
  Users,
  Calculator,
  ArrowRight,
  Coins,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import type { Ciudadano, Configuracion, Tramite } from "@/types/api";

/**
 * Constantes espejo del backend (server/src/lib/precios.ts).
 * Si se actualizan allá, hay que actualizarlas acá.
 */
const VVUMA_DEFAULT = 117.31;
const UMBRAL_ALTURA_PODA = 3;
const FACTOR_PODA_ALTO = 1.5;
const FACTOR_PODA_BAJO = 0.5;
// Servicio de Poda — rangos por altura
const SP_COTA_1 = 10;
const SP_COTA_2 = 14;
const SP_COTA_3 = 20;
const SP_FACTOR_1 = 4;
const SP_FACTOR_2 = 8;
const SP_FACTOR_3 = 12;
const SP_FACTOR_4 = 16;
// Servicio de Derribo — rangos por altura
const SD_COTA_1 = 10;
const SD_COTA_2 = 20;
const SD_FACTOR_1 = 15;
const SD_FACTOR_2 = 30;
const SD_FACTOR_3 = 45;

/** Redondea a 2 decimales (coincide con Decimal(10,2) del schema). */
const round2 = (n: number) => Math.round(n * 100) / 100;

function calcularPrecioPoda(altura: number | null, vvuma: number): number | null {
  if (altura === null || !Number.isFinite(altura) || altura < 0) return null;
  const factor = altura >= UMBRAL_ALTURA_PODA ? FACTOR_PODA_ALTO : FACTOR_PODA_BAJO;
  return round2(vvuma * factor);
}

// (Eliminado: `factorDerriboPara` y las constantes legacy
// FACTOR_DERRIBO_*, ESPECIES_DERRIBO_*, PINO_PREFIX. El cálculo
// oficial de PERMISO_DERRIBO ahora es volumétrico
// (calcularPrecioDerriboVolumetrico). La función de espejo del
// backend queda en server/src/lib/precios.ts.

// =================================================================
// USO_CONTENEDORES — precio según tipo de generador × meses
// =================================================================
// Las opciones del select `tipoGenerador` y su factor (multiplicador
// de VVUMA). Mismas opciones que en server/prisma/seed.ts.
const TIPOS_GENERADOR_CONTENEDOR: { value: string; label: string; factor: number }[] = [
  { value: "Micro-generador (1-40 kg/semana)", label: "Micro-generador (1-40 kg/sem)", factor: 3 },
  { value: "Pequeño generador (40-80 kg/semana)", label: "Pequeño generador (40-80 kg/sem)", factor: 4 },
  { value: "Pequeño generador (80-150 kg/semana)", label: "Pequeño generador (80-150 kg/sem)", factor: 6 },
  { value: "Pequeño generador (150-180 kg/semana)", label: "Pequeño generador (150-180 kg/sem)", factor: 8 },
  { value: "Pequeño generador (180-200 kg/semana)", label: "Pequeño generador (180-200 kg/sem)", factor: 11 },
];

/** Devuelve el factor para una opción de tipoGenerador, o null. */
function factorTipoGeneradorContenedor(value: string | null | undefined): number | null {
  if (!value) return null;
  const found = TIPOS_GENERADOR_CONTENEDOR.find((t) => t.value === value);
  return found ? found.factor : null;
}

/**
 * Precio = factor(tipoGenerador) × VVUMA × mesesPermiso
 * Devuelve null si falta algún dato.
 */
function calcularPrecioUsoContenedores(
  tipoGenerador: string | null | undefined,
  mesesPermiso: number | null | undefined,
  vvuma: number,
): number | null {
  const factor = factorTipoGeneradorContenedor(tipoGenerador);
  if (factor === null) return null;
  if (
    mesesPermiso === null ||
    mesesPermiso === undefined ||
    !Number.isFinite(mesesPermiso) ||
    mesesPermiso <= 0
  ) {
    return null;
  }
  return round2(factor * vvuma * mesesPermiso);
}

// =================================================================
// PERMISO DE DERRIBO — cálculo volumétrico (CalculadoraIMBIO.html)
// =================================================================
// Espejo de server/src/lib/precios.ts. Cada especie tiene:
//   - vvuma: vvuma por m³ de biomasa
//   - minimo: mínimo a cobrar (sólo Tarifa III "otra" lo tiene)
//   - factor: factor de forma sugerido (f)
//   - nombre: nombre legible
//   - cientifico: nombre científico (para autorrellenar)

interface TarifaDerribo {
  value: string;
  label: string;
  vvuma: number;
  minimo: number;
  factor: number;
  nombre: string;
  cientifico: string;
  grupo: "I" | "II" | "III";
}

const TARIFAS_DERRIBO: TarifaDerribo[] = [
  {
    value: "mezquite",
    label: "Mezquite (Prosopis laevigata)",
    vvuma: 30,
    minimo: 0,
    factor: 0.6,
    nombre: "Mezquite",
    cientifico: "Prosopis laevigata",
    grupo: "I",
  },
  {
    value: "huizache",
    label: "Huizache (Acacia spp.)",
    vvuma: 30,
    minimo: 0,
    factor: 0.55,
    nombre: "Huizache",
    cientifico: "Acacia spp.",
    grupo: "I",
  },
  {
    value: "sabino",
    label: "Sabino (Taxodium mucronatum)",
    vvuma: 30,
    minimo: 0,
    factor: 0.7,
    nombre: "Sabino",
    cientifico: "Taxodium mucronatum",
    grupo: "I",
  },
  {
    value: "yuca",
    label: "Yuca (Yucca spp.)",
    vvuma: 30,
    minimo: 0,
    factor: 0.55,
    nombre: "Yuca",
    cientifico: "Yucca spp.",
    grupo: "I",
  },
  {
    value: "pirul",
    label: "Pirul (Schinus molle)",
    vvuma: 5,
    minimo: 0,
    factor: 0.62,
    nombre: "Pirul",
    cientifico: "Schinus molle",
    grupo: "II",
  },
  {
    value: "pino",
    label: "Pino (Pinus spp.)",
    vvuma: 5,
    minimo: 0,
    factor: 0.45,
    nombre: "Pino",
    cientifico: "Pinus spp.",
    grupo: "II",
  },
  // ----- Tarifa III — Otras Especies (factores del HTML) -----
  {
    value: "eucalipto",
    label: "Eucalipto (Eucalyptus spp.)",
    vvuma: 8,
    minimo: 6,
    factor: 0.55,
    nombre: "Eucalipto",
    cientifico: "Eucalyptus spp.",
    grupo: "III",
  },
  {
    value: "trueno",
    label: "Trueno (Ligustrum lucidum)",
    vvuma: 8,
    minimo: 6,
    factor: 0.65,
    nombre: "Trueno",
    cientifico: "Ligustrum lucidum",
    grupo: "III",
  },
  {
    value: "pata_vaca",
    label: "Pata de vaca (Bauhinia variegata)",
    vvuma: 8,
    minimo: 6,
    factor: 0.58,
    nombre: "Pata de vaca",
    cientifico: "Bauhinia variegata",
    grupo: "III",
  },
  {
    value: "fresno",
    label: "Fresno (Fraxinus uhdei)",
    vvuma: 8,
    minimo: 6,
    factor: 0.68,
    nombre: "Fresno",
    cientifico: "Fraxinus uhdei",
    grupo: "III",
  },
  {
    value: "jacaranda",
    label: "Jacaranda (Jacaranda mimosifolia)",
    vvuma: 8,
    minimo: 6,
    factor: 0.6,
    nombre: "Jacaranda",
    cientifico: "Jacaranda mimosifolia",
    grupo: "III",
  },
  {
    value: "ficus",
    label: "Ficus (Ficus benjamina / nitida)",
    vvuma: 8,
    minimo: 6,
    factor: 0.72,
    nombre: "Ficus",
    cientifico: "Ficus benjamina / nitida",
    grupo: "III",
  },
  {
    value: "cedro_blanco",
    label: "Cedro blanco (Cupressus lindleyi)",
    vvuma: 8,
    minimo: 6,
    factor: 0.48,
    nombre: "Cedro blanco",
    cientifico: "Cupressus lindleyi",
    grupo: "III",
  },
  {
    value: "paraiso",
    label: "Árbol del paraíso (Melia azedarach)",
    vvuma: 8,
    minimo: 6,
    factor: 0.62,
    nombre: "Árbol del paraíso",
    cientifico: "Melia azedarach",
    grupo: "III",
  },
  {
    value: "colorin",
    label: "Colorín / Zompantle (Erythrina americana)",
    vvuma: 8,
    minimo: 6,
    factor: 0.55,
    nombre: "Colorín / Zompantle",
    cientifico: "Erythrina americana",
    grupo: "III",
  },
  {
    value: "sauce",
    label: "Sauce llorón (Salix babylonica)",
    vvuma: 8,
    minimo: 6,
    factor: 0.65,
    nombre: "Sauce llorón",
    cientifico: "Salix babylonica",
    grupo: "III",
  },
  {
    value: "otra",
    label: "Otra especie",
    vvuma: 8,
    minimo: 6,
    factor: 0.65,
    nombre: "Otra especie",
    cientifico: "",
    grupo: "III",
  },
];

/** Devuelve la tarifa de derribo para una especie (key), o null. */
function tarifaDerriboPara(value: string | null | undefined): TarifaDerribo | null {
  if (!value) return null;
  return TARIFAS_DERRIBO.find((t) => t.value === value) ?? null;
}

/** Devuelve el factor de forma sugerido para una especie, o null. */
function factorFormaDerriboPara(value: string | null | undefined): number | null {
  const t = tarifaDerriboPara(value);
  return t ? t.factor : null;
}

/** Resultado detallado del cálculo volumétrico de un Permiso de Derribo. */
interface DerriboVolumetrico {
  perimetroM: number;
  areaBasal: number;
  volumenFuste: number;
  volumenTotal: number;
  vvumaPorM3: number;
  aplicaMinimo: boolean;
  costo: number;
}

/**
 * Calcula el precio del Permiso de Derribo con la fórmula
 * volumétrica oficial (ver CalculadoraIMBIO.html, sección 1).
 *
 *   P(m)   = CAP(cm) / 100
 *   g      = P² / (4π)
 *   V fuste = g × h × f
 *   V total = V fuste × 1.20
 *   Costo   = V total × vvuma_especie
 *   (Tarifa III: si V total × vvuma < 6 → Costo = 6 × vvuma)
 *
 * Devuelve el desglose o null si falta algún dato.
 */
function calcularPrecioDerriboVolumetrico(
  especie: string | null,
  perimetro: number | null,
  altura: number | null,
  factorForma: number | null,
  vvuma: number,
): DerriboVolumetrico | null {
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
  const vvumaPorM3 = t.vvuma;
  const costoRaw = volumenTotal * vvumaPorM3;
  const aplicaMinimo = t.minimo > 0 && costoRaw < t.minimo;
  const costo = aplicaMinimo ? t.minimo : costoRaw;

  return {
    perimetroM,
    areaBasal,
    volumenFuste,
    volumenTotal,
    vvumaPorM3,
    aplicaMinimo,
    costo: round2(costo * vvuma),
  };
}

function factorServicioPodaPara(altura: number): number {
  if (altura <= SP_COTA_1) return SP_FACTOR_1;
  if (altura <= SP_COTA_2) return SP_FACTOR_2;
  if (altura <= SP_COTA_3) return SP_FACTOR_3;
  return SP_FACTOR_4;
}

function calcularPrecioServicioPoda(
  altura: number | null,
  vvuma: number,
): number | null {
  if (altura === null || !Number.isFinite(altura) || altura < 0) return null;
  return round2(vvuma * factorServicioPodaPara(altura));
}

function factorServicioDerriboPara(altura: number): number {
  if (altura < SD_COTA_1) return SD_FACTOR_1;
  if (altura < SD_COTA_2) return SD_FACTOR_2;
  return SD_FACTOR_3;
}

function calcularPrecioServicioDerribo(
  altura: number | null,
  vvuma: number,
): number | null {
  if (altura === null || !Number.isFinite(altura) || altura < 0) return null;
  return round2(vvuma * factorServicioDerriboPara(altura));
}

// =================================================================
// Tipos
// =================================================================
type WizardData = {
  tramite: Tramite | null;
  ciudadano: Partial<Ciudadano> | null;
  precioFinal: number | null;
  tecnicoAutoriza: string;
  /** Altura del árbol en metros. Aplica a PERMISO_PODA, SERVICIO_PODA,
   *  SERVICIO_DERRIBO y PERMISO_DERRIBO. */
  alturaArbol: number | null;
  /** PERMISO_DERRIBO: especie del árbol (key: mezquite, huizache, etc.).
   *  Reemplaza al antiguo `nombreComunArbol`. */
  especieArbol: string | null;
  /** PERMISO_DERRIBO: perímetro (CAP) en cm. */
  perimetroArbol: number | null;
  /** PERMISO_DERRIBO: factor de forma (f), 0.1-1. */
  factorFormaArbol: number | null;
  /** USO_CONTENEDORES: tipo de generador seleccionado. */
  tipoGenerador: string | null;
  /** USO_CONTENEDORES: cantidad de meses del permiso. */
  mesesPermiso: number | null;
  /**
   * Si el usuario editó manualmente el precio (por un descuento),
   * dejamos de recalcularlo al cambiar los datos del árbol.
   */
  precioManual: boolean;
};

const STEPS = [
  { id: "tramite", title: "Trámite" },
  { id: "ciudadano", title: "Ciudadano" },
  { id: "precio", title: "Precio" },
  { id: "revisar", title: "Resumen" },
];

const CATEGORIA_BADGE: Record<
  string,
  { label: string; variant: "sky" | "amber" | "red" }
> = {
  PERMISO: { label: "Permiso", variant: "sky" },
  SERVICIO: { label: "Servicio", variant: "amber" },
  SANCION: { label: "Sanción", variant: "red" },
};

// =================================================================
// Componente principal
// =================================================================
interface ServicioWizardProps {
  onSaved: (solicitudId: number, folio: string) => void;
  onCancel: () => void;
}

export function ServicioWizard({ onSaved, onCancel }: ServicioWizardProps) {
  const { status } = useServerStatus();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [vvuma, setVvuma] = useState<number>(VVUMA_DEFAULT);

  const [data, setData] = useState<WizardData>({
    tramite: null,
    ciudadano: null,
    precioFinal: null,
    tecnicoAutoriza: "",
    alturaArbol: null,
    especieArbol: null,
    perimetroArbol: null,
    factorFormaArbol: null,
    tipoGenerador: null,
    mesesPermiso: null,
    precioManual: false,
  });

  // Carga el valor de VVUMA desde la configuración del sistema
  // (sólo si estamos conectados). Si falla, usa el default.
  useEffect(() => {
    if (status !== "online") return;
    api
      .getConfiguracion()
      .then((c: Configuracion) => {
        const v = c.vvuma ? Number(c.vvuma) : VVUMA_DEFAULT;
        if (Number.isFinite(v) && v >= 0) setVvuma(v);
      })
      .catch(() => {
        // Si falla, mantenemos el default
      });
  }, [status]);

  const setDataField = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const next = () => {
    if (currentStep === 2) {
      // Para PERMISO_PODA, SERVICIO_PODA y SERVICIO_DERRIBO la altura es obligatoria.
      if (
        data.tramite?.codigo === "PERMISO_PODA" ||
        data.tramite?.codigo === "SERVICIO_PODA" ||
        data.tramite?.codigo === "SERVICIO_DERRIBO"
      ) {
        if (data.alturaArbol === null || data.alturaArbol < 0) {
          toast.error("Altura requerida", {
            description: "Indicá la altura del árbol en metros para calcular el precio",
          });
          return;
        }
      }
      // Para PERMISO_DERRIBO se requieren especie + perímetro (CAP) +
      // altura + factor de forma para el cálculo volumétrico del
      // precio (ver CalculadoraIMBIO.html).
      if (data.tramite?.codigo === "PERMISO_DERRIBO") {
        if (!data.especieArbol) {
          toast.error("Especie requerida", {
            description:
              "Elegí la especie del árbol para calcular el precio",
          });
          return;
        }
        if (data.perimetroArbol === null || data.perimetroArbol <= 0) {
          toast.error("Perímetro requerido", {
            description:
              "Indicá el perímetro (CAP) en cm para calcular el precio",
          });
          return;
        }
        if (data.alturaArbol === null || data.alturaArbol <= 0) {
          toast.error("Altura requerida", {
            description:
              "Indicá la altura del árbol en metros para calcular el precio",
          });
          return;
        }
        if (data.factorFormaArbol === null || data.factorFormaArbol <= 0) {
          toast.error("Factor de forma requerido", {
            description:
              "Indicá el factor de forma (f) o elegí una especie con factor sugerido",
          });
          return;
        }
      }
      if (data.precioFinal === null || data.precioFinal < 0) {
        toast.error("Precio requerido", {
          description: "Ingresá un precio válido para la solicitud",
        });
        return;
      }
    }
    setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setCurrentStep((s) => Math.max(0, s - 1));

  const handleSubmit = async () => {
    if (!data.tramite || !data.ciudadano?.id) {
      toast.error("Faltan datos", { description: "Revisa los pasos anteriores" });
      return;
    }
    setSubmitting(true);
    try {
      // Pre-llena el técnico en datos (si lo puso), así queda guardado
      // desde el inicio y aparece en el memorandum y se autollena al autorizar.
      const datosIniciales: Record<string, unknown> = {};
      if (data.tecnicoAutoriza.trim()) {
        datosIniciales.nombreTecnicoAutoriza = data.tecnicoAutoriza.trim();
      }
      // Para PERMISO_PODA, SERVICIO_PODA y SERVICIO_DERRIBO, la altura
      // va en datos.altura para que el backend calcule el precio:
      //   PERMISO_PODA      → 1.5× o 0.5× vvuma (>=3m o <3m)
      //   SERVICIO_PODA     → 4/8/12/16 × vvuma según rangos
      //   SERVICIO_DERRIBO  → 15/30/45 × vvuma según rangos
      if (
        (data.tramite.codigo === "PERMISO_PODA" ||
          data.tramite.codigo === "SERVICIO_PODA" ||
          data.tramite.codigo === "SERVICIO_DERRIBO") &&
        data.alturaArbol !== null
      ) {
        datosIniciales.altura = data.alturaArbol;
      }
      // Para PERMISO_DERRIBO, se persisten los campos del nuevo cálculo
      // volumétrico (CalculadoraIMBIO.html):
      //   especie, perimetro (cm), altura (m), factorForma
      // y se autorrellena el nombreCientifico desde la especie elegida
      // para que aparezca pre-llenado en la autorización.
      if (data.tramite.codigo === "PERMISO_DERRIBO") {
        if (data.especieArbol) {
          datosIniciales.especie = data.especieArbol;
          const t = tarifaDerriboPara(data.especieArbol);
          if (t && t.cientifico) {
            datosIniciales.nombreCientifico = t.cientifico;
          }
        }
        if (data.perimetroArbol !== null) {
          datosIniciales.perimetro = data.perimetroArbol;
        }
        if (data.alturaArbol !== null) {
          datosIniciales.altura = data.alturaArbol;
        }
        if (data.factorFormaArbol !== null) {
          datosIniciales.factorForma = data.factorFormaArbol;
        }
      }
      // USO_CONTENEDORES: tipo de generador + meses del permiso
      // (se persisten en datos.tipoGenerador y datos.mesesPermiso
      // para que la autorización los pre-llene y la fecha de
      // vencimiento se calcule en el momento de generar la autorización).
      if (data.tramite.codigo === "USO_CONTENEDORES") {
        if (data.tipoGenerador) datosIniciales.tipoGenerador = data.tipoGenerador;
        if (data.mesesPermiso !== null) datosIniciales.mesesPermiso = data.mesesPermiso;
      }

      const created = await api.crearSolicitud({
        ciudadanoId: data.ciudadano.id,
        tramiteId: data.tramite.id,
        datos: datosIniciales,
        // El backend recalcula el precio para PERMISO_PODA;
        // mandamos un valor de todas formas para mantener consistencia.
        precioFinal: data.precioFinal ?? undefined,
      });
      onSaved(created.id, created.folio);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo crear la solicitud";
      toast.error("Error al guardar", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Stepper steps={STEPS} currentStep={currentStep} />

      <div className="min-h-[420px] py-2">
        {currentStep === 0 && (
          <PasoTramite
            selected={data.tramite}
            onSelect={(t) => {
              setDataField("tramite", t);
              setDataField("alturaArbol", null);
              setDataField("especieArbol", null);
              setDataField("perimetroArbol", null);
              setDataField("factorFormaArbol", null);
              setDataField("tipoGenerador", null);
              setDataField("mesesPermiso", null);
              setDataField("precioManual", false);
              // Default: precio base del trámite
              setDataField("precioFinal", t.precioBase ? Number(t.precioBase) : 0);
            }}
          />
        )}
        {currentStep === 1 && (
          <PasoCiudadano
            selected={data.ciudadano}
            onSelect={(c) => setDataField("ciudadano", c)}
          />
        )}
        {currentStep === 2 && data.tramite && (
          <PasoPrecio
            tramite={data.tramite}
            precioFinal={data.precioFinal}
            tecnicoAutoriza={data.tecnicoAutoriza}
            alturaArbol={data.alturaArbol}
            especieArbol={data.especieArbol}
            perimetroArbol={data.perimetroArbol}
            alturaArbolDerribo={data.alturaArbol}
            factorFormaArbol={data.factorFormaArbol}
            tipoGenerador={data.tipoGenerador}
            mesesPermiso={data.mesesPermiso}
            precioManual={data.precioManual}
            vvuma={vvuma}
            onPrecioChange={(p) => {
              setDataField("precioFinal", p);
              setDataField("precioManual", true);
            }}
            onTecnicoChange={(t) => setDataField("tecnicoAutoriza", t)}
            onTipoGeneradorChange={(s) => {
              setDataField("tipoGenerador", s);
              // Si es USO_CONTENEDORES y el usuario NO ha editado el
              // precio manualmente, recalcular automáticamente.
              if (
                !data.precioManual &&
                data.tramite?.codigo === "USO_CONTENEDORES"
              ) {
                const calc = calcularPrecioUsoContenedores(
                  s,
                  data.mesesPermiso,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc);
                }
              }
            }}
            onMesesPermisoChange={(m) => {
              setDataField("mesesPermiso", m);
              if (
                !data.precioManual &&
                data.tramite?.codigo === "USO_CONTENEDORES"
              ) {
                const calc = calcularPrecioUsoContenedores(
                  data.tipoGenerador,
                  m,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc);
                }
              }
            }}
            onAlturaChange={(h) => {
              setDataField("alturaArbol", h);
              // Si es PERMISO_PODA / SERVICIO_PODA / SERVICIO_DERRIBO y
              // el usuario NO ha editado el precio manualmente, recalcular
              // automáticamente.
              if (
                !data.precioManual &&
                (data.tramite?.codigo === "PERMISO_PODA" ||
                  data.tramite?.codigo === "SERVICIO_PODA" ||
                  data.tramite?.codigo === "SERVICIO_DERRIBO")
              ) {
                const cod = data.tramite?.codigo;
                const calc =
                  cod === "PERMISO_PODA"
                    ? calcularPrecioPoda(h, vvuma)
                    : cod === "SERVICIO_PODA"
                    ? calcularPrecioServicioPoda(h, vvuma)
                    : calcularPrecioServicioDerribo(h, vvuma);
                if (calc !== null) {
                  setDataField("precioFinal", calc);
                }
              }
            }}
            onEspecieChange={(s) => {
              setDataField("especieArbol", s);
              // Al elegir especie, autorrellenar factor de forma
              // sugerido (sólo si el usuario NO lo editó manualmente).
              if (s) {
                const f = factorFormaDerriboPara(s);
                if (f !== null) {
                  setDataField("factorFormaArbol", f);
                }
              }
              // Recalcular precio si es PERMISO_DERRIBO y no se ha
              // editado manualmente.
              if (
                data.tramite?.codigo === "PERMISO_DERRIBO" &&
                !data.precioManual
              ) {
                const calc = calcularPrecioDerriboVolumetrico(
                  s,
                  data.perimetroArbol,
                  data.alturaArbol,
                  s ? factorFormaDerriboPara(s) : data.factorFormaArbol,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc.costo);
                }
              }
            }}
            onPerimetroChange={(p) => {
              setDataField("perimetroArbol", p);
              if (
                data.tramite?.codigo === "PERMISO_DERRIBO" &&
                !data.precioManual
              ) {
                const calc = calcularPrecioDerriboVolumetrico(
                  data.especieArbol,
                  p,
                  data.alturaArbol,
                  data.factorFormaArbol,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc.costo);
                }
              }
            }}
            onAlturaDerriboChange={(h) => {
              setDataField("alturaArbol", h);
              if (
                data.tramite?.codigo === "PERMISO_DERRIBO" &&
                !data.precioManual
              ) {
                const calc = calcularPrecioDerriboVolumetrico(
                  data.especieArbol,
                  data.perimetroArbol,
                  h,
                  data.factorFormaArbol,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc.costo);
                }
              }
            }}
            onFactorFormaChange={(f) => {
              setDataField("factorFormaArbol", f);
              if (
                data.tramite?.codigo === "PERMISO_DERRIBO" &&
                !data.precioManual
              ) {
                const calc = calcularPrecioDerriboVolumetrico(
                  data.especieArbol,
                  data.perimetroArbol,
                  data.alturaArbol,
                  f,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc.costo);
                }
              }
            }}
            onResetAutoPrice={() => {
              // El usuario decide volver al cálculo automático (ej. quitó
              // un descuento). Aplica a PERMISO_PODA / SERVICIO_PODA /
              // SERVICIO_DERRIBO (con altura) o PERMISO_DERRIBO
              // (con nombre común).
              if (data.tramite?.codigo === "PERMISO_PODA") {
                const calc = calcularPrecioPoda(data.alturaArbol, vvuma);
                if (calc !== null) {
                  setDataField("precioFinal", calc);
                  setDataField("precioManual", false);
                }
              } else if (data.tramite?.codigo === "SERVICIO_PODA") {
                const calc = calcularPrecioServicioPoda(
                  data.alturaArbol,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc);
                  setDataField("precioManual", false);
                }
              } else if (data.tramite?.codigo === "SERVICIO_DERRIBO") {
                const calc = calcularPrecioServicioDerribo(
                  data.alturaArbol,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc);
                  setDataField("precioManual", false);
                }
              } else if (data.tramite?.codigo === "PERMISO_DERRIBO") {
                // Recalcular con la fórmula volumétrica nueva
                // (especie + perimetro + altura + factorForma)
                const calc = calcularPrecioDerriboVolumetrico(
                  data.especieArbol,
                  data.perimetroArbol,
                  data.alturaArbol,
                  data.factorFormaArbol,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc.costo);
                  setDataField("precioManual", false);
                }
              } else if (data.tramite?.codigo === "USO_CONTENEDORES") {
                const calc = calcularPrecioUsoContenedores(
                  data.tipoGenerador,
                  data.mesesPermiso,
                  vvuma,
                );
                if (calc !== null) {
                  setDataField("precioFinal", calc);
                  setDataField("precioManual", false);
                }
              }
            }}
          />
        )}
        {currentStep === 3 && data.tramite && data.ciudadano && (
          <PasoRevisar
            tramite={data.tramite}
            ciudadano={data.ciudadano as Ciudadano}
            precioFinal={data.precioFinal}
            alturaArbol={data.alturaArbol}
            especieArbol={data.especieArbol}
            perimetroArbol={data.perimetroArbol}
            factorFormaArbol={data.factorFormaArbol}
            vvuma={vvuma}
          />
        )}
      </div>

      {/* Botones de navegación */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="ghost"
          onClick={currentStep === 0 ? onCancel : back}
          disabled={submitting}
        >
          <ChevronLeft className="h-4 w-4" />
          {currentStep === 0 ? "Cancelar" : "Atrás"}
        </Button>

        <div className="text-xs text-muted-foreground">
          {currentStep + 1} / {STEPS.length}
        </div>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={next}
            disabled={
              (currentStep === 0 && !data.tramite) ||
              (currentStep === 1 && !data.ciudadano?.id) ||
              (currentStep === 2 &&
                (data.precioFinal === null || data.precioFinal < 0)) ||
              (currentStep === 2 &&
                (data.tramite?.codigo === "PERMISO_PODA" ||
                  data.tramite?.codigo === "SERVICIO_PODA" ||
                  data.tramite?.codigo === "SERVICIO_DERRIBO") &&
                (data.alturaArbol === null || data.alturaArbol < 0)) ||
              (currentStep === 2 &&
                data.tramite?.codigo === "PERMISO_DERRIBO" &&
                (!data.especieArbol ||
                  data.perimetroArbol === null ||
                  data.perimetroArbol <= 0 ||
                  data.alturaArbol === null ||
                  data.alturaArbol <= 0 ||
                  data.factorFormaArbol === null ||
                  data.factorFormaArbol <= 0)) ||
              (currentStep === 2 &&
                data.tramite?.codigo === "USO_CONTENEDORES" &&
                (!data.tipoGenerador ||
                  data.mesesPermiso === null ||
                  data.mesesPermiso <= 0))
            }
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting || status !== "online"}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirmar
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// =================================================================
// Paso 1: Seleccionar trámite
// =================================================================
function PasoTramite({
  selected,
  onSelect,
}: {
  selected: Tramite | null;
  onSelect: (t: Tramite) => void;
}) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Tramite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status !== "online") {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .listarTramites({ activo: true })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [status]);

  const filtered = items.filter(
    (t) =>
      !search ||
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.codigo.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar trámite..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando catálogo...
        </div>
      ) : (
        <div className="grid max-h-[420px] grid-cols-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
          {filtered.map((t) => {
            const isSelected = selected?.id === t.id;
            const badge = CATEGORIA_BADGE[t.categoria] ?? CATEGORIA_BADGE.PERMISO;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-all",
                  isSelected
                    ? "border-amber-500 bg-amber-50 shadow-md"
                    : "border-slate-200 hover:border-amber-300 hover:bg-amber-50/30",
                )}
              >
                <div className="mb-2 flex items-start justify-between">
                  <Briefcase
                    className={cn(
                      "h-5 w-5",
                      isSelected ? "text-amber-600" : "text-slate-400",
                    )}
                  />
                  {isSelected && <Check className="h-5 w-5 text-amber-600" />}
                </div>
                <p className="text-sm font-semibold leading-tight">{t.nombre}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {t.codigo}
                </p>
                <div className="mt-3">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =================================================================
// Paso 2: Buscar / crear ciudadano
// =================================================================
function PasoCiudadano({
  selected,
  onSelect,
}: {
  selected: Partial<Ciudadano> | null;
  onSelect: (c: Partial<Ciudadano>) => void;
}) {
  const { status } = useServerStatus();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Ciudadano[]>([]);
  const [recientes, setRecientes] = useState<Ciudadano[]>([]);
  const [loadingRecientes, setLoadingRecientes] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "online") {
      setLoadingRecientes(false);
      return;
    }
    setLoadingRecientes(true);
    api
      .listarCiudadanos({ limit: 3 })
      .then((res) => setRecientes(res.data.slice(0, 3)))
      .catch(() => setRecientes([]))
      .finally(() => setLoadingRecientes(false));
  }, [status]);

  const doSearch = async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await api.listarCiudadanos({ q, limit: 10 });
      setResults(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error en la búsqueda");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, apellido o CURP..."
          className="pl-9"
        />
      </div>

      {/* Recientes (solo si NO hay búsqueda) */}
      {!search && status === "online" && (
        <div className="space-y-2">
          {loadingRecientes ? (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : recientes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm text-muted-foreground">
              No hay ciudadanos registrados todavía.
            </div>
          ) : (
            <div className="space-y-2">
              {recientes.map((c) => {
                const isSelected = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                      isSelected
                        ? "border-amber-500 bg-amber-50"
                        : "border-slate-200 hover:border-amber-300 hover:bg-amber-50/30",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-semibold text-white">
                        {c.nombre.charAt(0)}
                        {c.apellidoPaterno.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {c.apellidoPaterno} {c.apellidoMaterno ?? ""} {c.nombre}
                        </p>
                        <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                          {c.curp && <span className="font-mono">{c.curp}</span>}
                          {c.telefono && <span>📞 {c.telefono}</span>}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <Check className="h-5 w-5 text-amber-600" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Resultados de búsqueda */}
      {searching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Buscando...
        </div>
      )}

      {error && !searching && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {search.length >= 2 && !searching && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-muted-foreground">
          No se encontraron ciudadanos con "{search}".
        </div>
      )}

      {results.length > 0 && (
        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
          {results.map((c) => {
            const isSelected = selected?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                  isSelected
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-200 hover:border-amber-300 hover:bg-amber-50/30",
                )}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {c.apellidoPaterno} {c.apellidoMaterno ?? ""} {c.nombre}
                  </p>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    {c.curp && <span className="font-mono">{c.curp}</span>}
                    {c.telefono && <span>📞 {c.telefono}</span>}
                  </div>
                </div>
                {isSelected ? (
                  <Check className="h-5 w-5 text-amber-600" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =================================================================
// Paso 3: Precio + Técnico que autoriza
// =================================================================

// (Eliminado: ARBOLES_DERRIBO ya no se usa. La selección de árbol
// para PERMISO_DERRIBO ahora se hace con el campo `especie` del
// formulario, cuyas opciones están definidas en el seed del backend
// y se renderizan como <optgroup> en PasoPrecio.)

function PasoPrecio({
  tramite,
  precioFinal,
  tecnicoAutoriza,
  alturaArbol,
  especieArbol,
  perimetroArbol,
  alturaArbolDerribo,
  factorFormaArbol,
  tipoGenerador,
  mesesPermiso,
  precioManual,
  vvuma,
  onPrecioChange,
  onTecnicoChange,
  onAlturaChange,
  onEspecieChange,
  onPerimetroChange,
  onAlturaDerriboChange,
  onFactorFormaChange,
  onTipoGeneradorChange,
  onMesesPermisoChange,
  onResetAutoPrice,
}: {
  tramite: Tramite;
  precioFinal: number | null;
  tecnicoAutoriza: string;
  alturaArbol: number | null;
  /** PERMISO_DERRIBO: especie del árbol (key). */
  especieArbol: string | null;
  /** PERMISO_DERRIBO: perímetro (CAP) en cm. */
  perimetroArbol: number | null;
  /** PERMISO_DERRIBO: altura en m (separada de `alturaArbol` para
   *  no romper la lógica de poda/servicio). */
  alturaArbolDerribo: number | null;
  /** PERMISO_DERRIBO: factor de forma (f). */
  factorFormaArbol: number | null;
  tipoGenerador: string | null;
  mesesPermiso: number | null;
  precioManual: boolean;
  vvuma: number;
  onPrecioChange: (p: number) => void;
  onTecnicoChange: (t: string) => void;
  onAlturaChange: (h: number | null) => void;
  onEspecieChange: (s: string | null) => void;
  onPerimetroChange: (p: number | null) => void;
  onAlturaDerriboChange: (h: number | null) => void;
  onFactorFormaChange: (f: number | null) => void;
  onTipoGeneradorChange: (s: string | null) => void;
  onMesesPermisoChange: (m: number | null) => void;
  onResetAutoPrice: () => void;
}) {
  const precioBase = tramite.precioBase ? Number(tramite.precioBase) : 0;
  const isPoda = tramite.codigo === "PERMISO_PODA";
  const isDerribo = tramite.codigo === "PERMISO_DERRIBO";
  const isServicioPoda = tramite.codigo === "SERVICIO_PODA";
  const isServicioDerribo = tramite.codigo === "SERVICIO_DERRIBO";

  return (
    <div className="space-y-4">
      {/* Altura del árbol (para PERMISO_PODA, SERVICIO_PODA, SERVICIO_DERRIBO) */}
      {(isPoda || isServicioPoda || isServicioDerribo) && (
        <div className="space-y-2">
          <Label htmlFor="alturaArbol">
            Altura del árbol (m) <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="alturaArbol"
              type="number"
              min="0"
              step="0.1"
              value={alturaArbol ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onAlturaChange(v === "" ? null : Number(v));
              }}
              placeholder="Ej: 4.5"
              className="pr-12 text-lg"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              m
            </span>
          </div>
          {isServicioPoda && alturaArbol !== null && (
            <p className="text-xs text-muted-foreground">
              Factor:{" "}
              <span className="font-mono font-semibold">
                {factorServicioPodaPara(alturaArbol)} × VVUMA
              </span>{" "}
              ={" "}
              <span className="font-mono font-semibold">
                ${(vvuma * factorServicioPodaPara(alturaArbol)).toFixed(2)}
              </span>
              <span className="ml-2 text-muted-foreground">
                (rangos: 0–10m ×4 · 10–14m ×8 · 14–20m ×12 · &gt;20m ×16)
              </span>
            </p>
          )}
          {isServicioDerribo && alturaArbol !== null && (
            <p className="text-xs text-muted-foreground">
              Factor:{" "}
              <span className="font-mono font-semibold">
                {factorServicioDerriboPara(alturaArbol)} × VVUMA
              </span>{" "}
              ={" "}
              <span className="font-mono font-semibold">
                ${(vvuma * factorServicioDerriboPara(alturaArbol)).toFixed(2)}
              </span>
              <span className="ml-2 text-muted-foreground">
                (rangos: 0–9.9m ×15 · 10–19.9m ×30 · &ge;20m ×45)
              </span>
            </p>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* PERMISO_DERRIBO: cálculo volumétrico (CalculadoraIMBIO.html)  */}
      {/* ============================================================ */}
      {isDerribo && (
        <div className="space-y-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/30 p-4">
          <div className="flex items-center gap-2 text-emerald-900">
            <Calculator className="h-4 w-4" />
            <span className="text-sm font-semibold">
              Cálculo volumétrico del permiso
            </span>
            <span className="ml-auto text-xs text-emerald-700">
              V = g · h · f · 1.20
            </span>
          </div>

          {/* Especie del árbol */}
          <div className="space-y-2">
            <Label htmlFor="especieArbol">
              Especie del árbol <span className="text-red-500">*</span>
            </Label>
            <select
              id="especieArbol"
              value={especieArbol ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : e.target.value;
                onEspecieChange(v);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Seleccionar especie —</option>
              <optgroup label="Tarifa I · 30 vvuma/m³">
                {TARIFAS_DERRIBO.filter((t) => t.grupo === "I").map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Tarifa II · 5 vvuma/m³">
                {TARIFAS_DERRIBO.filter((t) => t.grupo === "II").map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Otras Especies · Tarifa III · 8 vvuma/m³ · mínimo 6 vvuma">
                {TARIFAS_DERRIBO.filter(
                  (t) => t.grupo === "III" && t.value !== "otra",
                ).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
                <option value="otra">
                  Otra especie (genérica — sin factor sugerido)
                </option>
              </optgroup>
            </select>
            {especieArbol && (
              <p className="text-xs text-muted-foreground">
                Tarifa:{" "}
                <span className="font-mono font-semibold">
                  {(() => {
                    const t = tarifaDerriboPara(especieArbol);
                    return t
                      ? `${t.vvuma} vvuma/m³${t.minimo ? ` · mín ${t.minimo} vvuma` : ""}`
                      : "—";
                  })()}
                </span>
              </p>
            )}
          </div>

          {/* Perímetro (CAP) y Altura en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="perimetroArbol">
                Perímetro (CAP) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="perimetroArbol"
                  type="number"
                  min="1"
                  step="0.1"
                  value={perimetroArbol ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPerimetroChange(v === "" ? null : Number(v));
                  }}
                  placeholder="Ej. 110"
                  className="pr-12 text-lg"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  cm
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alturaArbolDerribo">
                Altura del árbol <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="alturaArbolDerribo"
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={alturaArbolDerribo ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onAlturaDerriboChange(v === "" ? null : Number(v));
                  }}
                  placeholder="Ej. 8.5"
                  className="pr-8 text-lg"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  m
                </span>
              </div>
            </div>
          </div>

          {/* Factor de forma (f) */}
          <div className="space-y-2">
            <Label htmlFor="factorFormaArbol">
              Factor de forma (f) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="factorFormaArbol"
                type="number"
                min="0.1"
                max="1"
                step="0.01"
                value={factorFormaArbol ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onFactorFormaChange(v === "" ? null : Number(v));
                }}
                placeholder="0.7"
                className="pr-8 text-lg"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                f
              </span>
            </div>
            {especieArbol && (
              <p className="text-xs text-muted-foreground">
                Sugerido para{" "}
                <span className="font-mono">
                  {tarifaDerriboPara(especieArbol)?.nombre}:
                </span>{" "}
                <span className="font-mono font-semibold">
                  f = {factorFormaDerriboPara(especieArbol)?.toFixed(2)}
                </span>
              </p>
            )}
          </div>

          {/* Desglose del cálculo en vivo */}
          {(() => {
            const r = calcularPrecioDerriboVolumetrico(
              especieArbol,
              perimetroArbol,
              alturaArbolDerribo,
              factorFormaArbol,
              vvuma,
            );
            if (!r) return null;
            return (
              <div className="space-y-1 rounded-md border border-emerald-300 bg-white/70 p-3 text-xs">
                <p className="font-mono">
                  P = {r.perimetroM.toFixed(3)} m · g ={" "}
                  {r.areaBasal.toFixed(6)} m²
                </p>
                <p className="font-mono">
                  V fuste = {r.volumenFuste.toFixed(4)} m³ · V total (×1.20) ={" "}
                  {r.volumenTotal.toFixed(4)} m³
                </p>
                <p className="font-mono">
                  Costo = {r.volumenTotal.toFixed(4)} × {r.vvumaPorM3} vvuma/m³ ×{" "}
                  ${vvuma.toFixed(2)} ={" "}
                  <span className="font-semibold">
                    $
                    {r.costo.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </p>
                {r.aplicaMinimo && (
                  <p className="font-mono text-amber-700">
                    ⚠ Se aplicó el mínimo de Tarifa III (6 vvuma × ${vvuma.toFixed(2)}{" "}
                    = $
                    {(6 * vvuma).toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    )
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================== */}
      {/* USO_CONTENEDORES: tipo de generador + meses  */}
      {/* =========================================== */}
      {tramite.codigo === "USO_CONTENEDORES" && (
        <div className="space-y-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/30 p-4">
          <div className="flex items-center gap-2 text-emerald-900">
            <Coins className="h-4 w-4" />
            <span className="text-sm font-semibold">Cálculo por tipo de generador</span>
            <span className="ml-auto text-xs text-emerald-700">
              precio = factor × VVUMA × meses
            </span>
          </div>

          {/* Tipo de generador */}
          <div className="space-y-2">
            <Label htmlFor="tipoGenerador">
              Tipo de generador <span className="text-red-500">*</span>
            </Label>
            <select
              id="tipoGenerador"
              value={tipoGenerador ?? ""}
              onChange={(e) =>
                onTipoGeneradorChange(
                  e.target.value === "" ? null : e.target.value,
                )
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Seleccionar —</option>
              {TIPOS_GENERADOR_CONTENEDOR.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label} · {g.factor} × VVUMA
                </option>
              ))}
            </select>
            {tipoGenerador && (
              <p className="text-xs text-muted-foreground">
                Factor:{" "}
                <span className="font-mono font-semibold">
                  {factorTipoGeneradorContenedor(tipoGenerador)} × VVUMA
                </span>
              </p>
            )}
          </div>

          {/* Meses del permiso */}
          <div className="space-y-2">
            <Label htmlFor="mesesPermiso">
              Cantidad de meses del permiso{" "}
              <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="mesesPermiso"
                type="number"
                min={1}
                max={60}
                step={1}
                value={mesesPermiso ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onMesesPermisoChange(v === "" ? null : Number(v));
                }}
                placeholder="Ej: 12"
                className="pr-16 text-lg"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                meses
              </span>
            </div>
            {tipoGenerador && mesesPermiso && mesesPermiso > 0 && (
              <p className="text-xs text-muted-foreground">
                Cálculo:{" "}
                <span className="font-mono">
                  {factorTipoGeneradorContenedor(tipoGenerador)} ×{" "}
                  {vvuma.toFixed(2)} × {mesesPermiso} ={" "}
                </span>
                <span className="font-mono font-semibold">
                  $
                  {(
                    factorTipoGeneradorContenedor(tipoGenerador)! *
                    vvuma *
                    mesesPermiso
                  ).toFixed(2)}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="precioFinal">Precio final (MXN)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id="precioFinal"
            type="number"
            min="0"
            step="0.01"
            value={precioFinal ?? ""}
            onChange={(e) => onPrecioChange(Number(e.target.value) || 0)}
            placeholder={precioBase ? precioBase.toFixed(2) : "0.00"}
            className="pl-7 text-lg"
          />
        </div>
        {isPoda || isDerribo || isServicioPoda || isServicioDerribo ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {precioManual ? (
                <>
                  Precio con ajuste manual
                  <span className="ml-1 font-mono text-amber-700">
                    (descuento aplicado)
                  </span>
                </>
              ) : (
                <>Precio calculado por la fórmula del trámite</>
              )}
            </span>
            {precioManual && (
              <button
                type="button"
                onClick={onResetAutoPrice}
                className="text-xs font-medium text-sky-700 hover:underline"
              >
                Restablecer al cálculo automático
              </button>
            )}
          </div>
        ) : (
          precioBase > 0 && (
            <p className="text-xs text-muted-foreground">
              Precio base del catálogo:{" "}
              <span className="font-mono">${precioBase.toFixed(2)}</span>
            </p>
          )
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tecnicoAutoriza">Nombre del Técnico que Autoriza</Label>
        <Input
          id="tecnicoAutoriza"
          placeholder="Ej: Biol. Luis Felipe Lozano Román"
          value={tecnicoAutoriza}
          onChange={(e) => onTecnicoChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// =================================================================
// Paso 4: Revisar
// =================================================================
function PasoRevisar({
  tramite,
  ciudadano,
  precioFinal,
  alturaArbol,
  especieArbol,
  perimetroArbol,
  factorFormaArbol,
  vvuma,
}: {
  tramite: Tramite;
  ciudadano: Ciudadano;
  precioFinal: number | null;
  alturaArbol: number | null;
  /** PERMISO_DERRIBO: especie del árbol. */
  especieArbol: string | null;
  /** PERMISO_DERRIBO: perímetro (CAP) en cm. */
  perimetroArbol: number | null;
  /** PERMISO_DERRIBO: factor de forma (f). */
  factorFormaArbol: number | null;
  vvuma: number;
}) {
  const isPoda = tramite.codigo === "PERMISO_PODA";
  const isDerribo = tramite.codigo === "PERMISO_DERRIBO";
  const isServicioPoda = tramite.codigo === "SERVICIO_PODA";
  const isServicioDerribo = tramite.codigo === "SERVICIO_DERRIBO";

  // Para PERMISO_DERRIBO, calculamos el desglose volumétrico para el resumen
  const derriboVol =
    isDerribo
      ? calcularPrecioDerriboVolumetrico(
          especieArbol,
          perimetroArbol,
          alturaArbol,
          factorFormaArbol,
          vvuma,
        )
      : null;
  const tarifaDerriboInfo = isDerribo ? tarifaDerriboPara(especieArbol) : null;

  const factorServicioPoda =
    isServicioPoda && alturaArbol !== null
      ? factorServicioPodaPara(alturaArbol)
      : null;
  const factorServicioDerribo =
    isServicioDerribo && alturaArbol !== null
      ? factorServicioDerriboPara(alturaArbol)
      : null;

  return (
    <div className="space-y-3">
      {/* Servicio */}
      <div className="rounded-lg border bg-slate-50/50 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" />
          Trámite
        </div>
        <p className="mt-2 text-sm font-semibold">{tramite.nombre}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{tramite.codigo}</p>
      </div>

      {/* Ciudadano */}
      <div className="rounded-lg border bg-slate-50/50 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Ciudadano
        </div>
        <p className="mt-2 text-sm font-semibold">
          {ciudadano.nombre} {ciudadano.apellidoPaterno}{" "}
          {ciudadano.apellidoMaterno ?? ""}
        </p>
        <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
          {ciudadano.curp && <span className="font-mono">CURP: {ciudadano.curp}</span>}
          {ciudadano.telefono && <span>Tel: {ciudadano.telefono}</span>}
        </div>
      </div>

      {/* Datos del árbol — podá */}
      {isPoda && (
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <Calculator className="h-3.5 w-3.5" />
            Datos del árbol
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Altura</p>
              <p className="font-mono font-semibold">
                {alturaArbol !== null ? `${alturaArbol} m` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Factor aplicado</p>
              <p className="font-mono font-semibold">
                {alturaArbol !== null
                  ? alturaArbol >= UMBRAL_ALTURA_PODA
                    ? `${FACTOR_PODA_ALTO} × VVUMA`
                    : `${FACTOR_PODA_BAJO} × VVUMA`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Datos del árbol — derribo (cálculo volumétrico) */}
      {isDerribo && (
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <Calculator className="h-3.5 w-3.5" />
            Datos del árbol (cálculo volumétrico)
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Especie</p>
              <p className="font-mono font-semibold">
                {tarifaDerriboInfo?.nombre ?? especieArbol ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tarifa</p>
              <p className="font-mono font-semibold">
                {tarifaDerriboInfo
                  ? `${tarifaDerriboInfo.vvuma} vvuma/m³${
                      tarifaDerriboInfo.minimo
                        ? ` (mín ${tarifaDerriboInfo.minimo})`
                        : ""
                    }`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Perímetro (CAP)</p>
              <p className="font-mono font-semibold">
                {perimetroArbol !== null ? `${perimetroArbol} cm` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Altura</p>
              <p className="font-mono font-semibold">
                {alturaArbol !== null ? `${alturaArbol} m` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Factor de forma (f)</p>
              <p className="font-mono font-semibold">
                {factorFormaArbol !== null ? factorFormaArbol.toFixed(2) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Volumen total</p>
              <p className="font-mono font-semibold">
                {derriboVol
                  ? `${derriboVol.volumenTotal.toFixed(4)} m³`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Datos del árbol — servicio de poda */}
      {isServicioPoda && (
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <Calculator className="h-3.5 w-3.5" />
            Datos del árbol
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Altura</p>
              <p className="font-mono font-semibold">
                {alturaArbol !== null ? `${alturaArbol} m` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Factor aplicado</p>
              <p className="font-mono font-semibold">
                {factorServicioPoda !== null
                  ? `${factorServicioPoda} × VVUMA`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Datos del árbol — servicio de derribo */}
      {isServicioDerribo && (
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <Calculator className="h-3.5 w-3.5" />
            Datos del árbol
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Altura</p>
              <p className="font-mono font-semibold">
                {alturaArbol !== null ? `${alturaArbol} m` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Factor aplicado</p>
              <p className="font-mono font-semibold">
                {factorServicioDerribo !== null
                  ? `${factorServicioDerribo} × VVUMA`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Precio */}
      <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4 text-center">
        <p className="text-xs uppercase tracking-widest text-emerald-800">Monto a pagar</p>
        <p className="mt-1 text-3xl font-bold text-emerald-900">
          ${(precioFinal ?? 0).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        {(isPoda || isDerribo || isServicioPoda || isServicioDerribo) && (
          <p className="mt-1 text-[10px] text-emerald-700">
            Calculado con VVUMA = ${vvuma.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}
