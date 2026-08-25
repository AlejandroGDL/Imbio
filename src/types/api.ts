/**
 * Tipos compartidos con el backend IMBIO.
 * Reflejan exactamente los modelos de server/prisma/schema.prisma
 * y los payloads de server/src/routes/*.ts
 */

// =================================================================
// Enums
// =================================================================

export type CategoriaTramite = "PERMISO" | "SERVICIO" | "SANCION";

export type EstadoSolicitud =
  | "REGISTRADA"
  | "PENDIENTE_PAGO"
  | "PAGADA"
  | "EN_REVISION"
  | "AUTORIZADA"
  | "RECHAZADA"
  | "CANCELADA";

export type TipoPago = "MEMORANDUM" | "EFECTIVO" | "TRANSFERENCIA" | "OTRO";

export type RolUsuario = "ADMIN" | "OPERADOR" | "TECNICO";

// =================================================================
// Campos dinámicos de Trámite
// =================================================================

export type TipoCampo =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "textarea"
  | "boolean"
  | "currency";

export interface CampoTramite {
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
  showInAuthorization?: boolean;
  afectaPrecio?: boolean;
  default?: string | number | boolean;
}

export interface ReglaPrecio {
  tipo: "rango" | "factor" | "compuesto";
  campo?: string;
  rangos?: { hasta: number; precio: number }[];
  valores?: Record<string, number>;
  reglas?: ReglaPrecio[];
}

// =================================================================
// Modelos
// =================================================================

export interface Ciudadano {
  id: number;
  curp: string | null;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  fechaNacimiento: string | null;
  notas: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tramite {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaTramite;
  campos: CampoTramite[];
  precioBase: string | null; // Decimal viene como string de Prisma
  reglaPrecio: ReglaPrecio | null;
  requierePago: boolean;
  activo: boolean;
  orden: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pago {
  id: number;
  solicitudId: number;
  folioPago: string;
  tipo: TipoPago;
  monto: string;
  fechaPago: string;
  lugarPago: string | null;
  observaciones: string | null;
  registradoPorId: number | null;
  createdAt: string;
}

export interface Tecnico {
  id: number;
  nombre: string;
  cargo: string;
  departamento: string | null;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  firma: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Autorizacion {
  id: number;
  solicitudId: number;
  numeroAutorizacion: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  emitidoPorId: number | null;
  considerandos: string | null;
  observaciones: string | null;
  documentoPdf: string | null; // base64 si existe
  createdAt: string;
  emitidoPor?: Tecnico | null;
}

export interface Solicitud {
  id: number;
  folio: string;
  ciudadanoId: number;
  tramiteId: number;
  estado: EstadoSolicitud;
  datos: Record<string, unknown>;
  precioFinal: string | null;
  fechaSolicitud: string;
  fechaAtencion: string | null;
  observaciones: string | null;
  registradoPorId: number | null;
  createdAt: string;
  updatedAt: string;
  // Relations (opcionales según el endpoint)
  ciudadano?: Partial<Ciudadano>;
  tramite?: Partial<Tramite>;
  pago?: Pago | null;
  autorizacion?: Autorizacion | null;
}

export interface Configuracion {
  id: 1;
  nombreInstitucion: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitioWeb: string | null;
  piePaginaAutorizacion: string | null;
  serieFolioSolicitud: string;
  serieFolioAutorizacion: string;
  siguienteFolioSolicitud: number;
  siguienteFolioAutorizacion: number;
  esServidor: boolean;
  /**
   * Valor de la UMA usado para cálculo de precios variables
   * (ej. Permiso de Poda). Se actualiza manualmente cada año.
   * Viene como string desde Prisma (Decimal).
   */
  vvuma: string | null;
  updatedAt: string;
}

// =================================================================
// Áreas Verdes
// =================================================================

/** Catálogo predefinido de áreas verdes municipales */
export const AREAS_VERDES_OPCIONES = [
  "Parque Infantil Morelos",
  "Parque Francisco Villa",
  "Jardín Juárez",
  "Parque Chaneques",
  "Parque Fracc. Popular",
  "Parque Cosmos 3",
  "Parque Cosmos 2",
  "Parque Progreso Sur",
  "Parque de la Plutarco",
  "Parque de Béisbol",
  "Unidad Deportiva",
  "Jardín Principal",
  "Otro",
] as const;

export type AreaVerdeOpcion = (typeof AREAS_VERDES_OPCIONES)[number];

/** Catálogo predefinido de tipos de evento */
export const TIPOS_EVENTO_OPCIONES = [
  "Social",
  "Cultural",
  "Deportivo",
  "Educativo",
  "Religioso",
  "Otro",
] as const;

export type TipoEventoOpcion = (typeof TIPOS_EVENTO_OPCIONES)[number];

export interface AreaVerde {
  id: number;
  areaVerde: string;
  /** Ubicación específica dentro del área (esquina, sector, etc.). */
  ubicacion: string | null;
  usuario: string;
  tipoEvento: string;
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM (24h) */
  horaInicio: string;
  horaFin: string;
  /** HH:MM (24h) — hora de montaje (cuando llegan a armar). */
  horaMontaje: string | null;
  /** HH:MM (24h) — hora de desmontaje (cuando retiran todo). */
  horaDesmontaje: string | null;
  responsable: string;
  telefono: string | null;
  observaciones: string | null;
  /** Folio del permiso (formato "CC-AV-####"). Se asigna al generar el PDF. */
  folioPermiso: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAreaVerdePayload {
  areaVerde: string;
  ubicacion: string;
  usuario: string;
  tipoEvento: string;
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM (24h) */
  horaInicio: string;
  horaFin: string;
  /** HH:MM (24h) */
  horaMontaje: string;
  /** HH:MM (24h) */
  horaDesmontaje: string;
  responsable: string;
  telefono?: string;
  observaciones?: string;
}

// =================================================================
// Correspondencia
// =================================================================

export type TipoCorrespondencia = "ENTRADA" | "SALIDA";
export type TipoDocumentoCorrespondencia = "MEMORANDUM" | "OFICIO";
export type StatusCorrespondencia = "PENDIENTE" | "ATENDIDO" | "ARCHIVADO";

export interface Correspondencia {
  id: number;
  tipo: TipoCorrespondencia;
  tipoDocumento: TipoDocumentoCorrespondencia;
  numero: string;
  /** YYYY-MM-DD */
  fecha: string;
  remitente: string;
  destinatario: string;
  asunto: string;
  observaciones: string | null;
  status: StatusCorrespondencia;
  // ===== Notificación =====
  /** Si el documento requiere una respuesta. */
  ocupaRespuesta: boolean;
  /** YYYY-MM-DD. Requerido si ocupaRespuesta = true. */
  fechaMaximaRespuesta: string | null;
  /** Si se requiere asistir a un evento (reunión, junta, etc.). */
  asisteAEvento: boolean;
  /**
   * Lista de días específicos del evento. No es un rango, son fechas
   * concretas que el usuario necesita capturar. Vacío si no aplica.
   * Ordenadas ascendente. Cada elemento es YYYY-MM-DD como string ISO.
   */
  fechasEvento: string[];
  /**
   * IDs del personal que debe asistir al evento.
   * Aplica solo si asisteAEvento = true.
   */
  asistentesIds: number[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCorrespondenciaPayload {
  tipo: TipoCorrespondencia;
  tipoDocumento: TipoDocumentoCorrespondencia;
  numero: string;
  /** YYYY-MM-DD */
  fecha: string;
  remitente: string;
  destinatario: string;
  asunto: string;
  observaciones?: string;
  // Notificación (opcional al crear; default false/null)
  ocupaRespuesta?: boolean;
  /** YYYY-MM-DD */
  fechaMaximaRespuesta?: string;
  asisteAEvento?: boolean;
  /**
   * Lista de días del evento (YYYY-MM-DD). El backend dedupica y ordena.
   * Si asisteAEvento=true, debe contener al menos 1 día.
   */
  fechasEvento?: string[];
  /**
   * IDs del personal que debe asistir al evento.
   */
  asistentesIds?: number[];
}

// =================================================================
// Personal
// =================================================================

export type TipoPersonal = "CONFIANZA" | "SINDICALIZADO";

export const TIPOS_PERSONAL_LABEL: Record<TipoPersonal, string> = {
  CONFIANZA: "Confianza",
  SINDICALIZADO: "Sindicalizado",
};

export interface Personal {
  id: number;
  nombre: string;
  apellidos: string;
  curp: string | null;
  /** YYYY-MM-DD */
  fechaNacimiento: string | null;
  telefono: string | null;
  domicilio: string | null;
  sabeManejar: boolean;
  tieneLicencia: boolean;
  /** YYYY-MM-DD */
  fechaExpedicionLicencia: string | null;
  /** YYYY-MM-DD */
  fechaExpiracionLicencia: string | null;
  puesto: string;
  /** YYYY-MM-DD */
  fechaIngreso: string;
  tipo: TipoPersonal;
  /** Ruta local "/uploads/personal/{filename}" o null. */
  foto: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonalPayload {
  nombre: string;
  apellidos: string;
  curp?: string;
  /** YYYY-MM-DD */
  fechaNacimiento?: string;
  telefono?: string;
  domicilio?: string;
  sabeManejar?: boolean;
  tieneLicencia?: boolean;
  /** YYYY-MM-DD */
  fechaExpedicionLicencia?: string;
  /** YYYY-MM-DD */
  fechaExpiracionLicencia?: string;
  puesto: string;
  /** YYYY-MM-DD */
  fechaIngreso: string;
  tipo: TipoPersonal;
  /** Foto: ruta absoluta del upload (ej. "/uploads/personal/abc.jpg") o null para borrar. */
  foto?: string | null;
}

// =================================================================
// Incidencias (tab dentro de Personal)
// =================================================================

export type TipoIncidencia =
  | "FALTA"
  | "JUSTIFICANTE"
  | "RETARDO"
  | "PERMISO_SIN_GOCE_SUELDO"
  | "PERMISO_CON_GOCE_SUELDO";

export const TIPOS_INCIDENCIA_LABEL: Record<TipoIncidencia, string> = {
  FALTA: "Falta",
  JUSTIFICANTE: "Justificante",
  RETARDO: "Retardo",
  PERMISO_SIN_GOCE_SUELDO: "Permiso sin goce de sueldo",
  PERMISO_CON_GOCE_SUELDO: "Permiso con goce de sueldo",
};

export interface IncidenciaEmpleadoRef {
  id: number;
  nombre: string;
  apellidos: string;
  puesto: string;
  tipo: TipoPersonal;
}

export interface Incidencia {
  id: number;
  personalId: number;
  tipo: TipoIncidencia;
  /** YYYY-MM-DD */
  fecha: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  // Relación (incluida en GET /incidencias y GET /incidencias/:id)
  personal?: IncidenciaEmpleadoRef;
}

export interface CreateIncidenciaPayload {
  personalId: number;
  tipo: TipoIncidencia;
  /** YYYY-MM-DD */
  fecha: string;
  descripcion?: string;
}

// =================================================================
// Vacaciones (tab dentro de Personal)
// =================================================================

export interface Vacacion {
  id: number;
  personalId: number;
  /** YYYY-MM-DD */
  fechaInicio: string;
  /** YYYY-MM-DD */
  fechaFin: string;
  diasSolicitados: number;
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  // Relación (incluida en GET /vacaciones y GET /vacaciones/:id)
  personal?: IncidenciaEmpleadoRef;
}

export interface CreateVacacionPayload {
  personalId: number;
  /** YYYY-MM-DD */
  fechaInicio: string;
  /** YYYY-MM-DD */
  fechaFin: string;
  diasSolicitados: number;
  observaciones?: string;
}

// =================================================================
// Días Económicos (tab dentro de Personal, exclusivo Sindicalizados)
// =================================================================

export interface DiaEconomico {
  id: number;
  personalId: number;
  /** Año de 4 dígitos, ej. 2026 */
  anio: number;
  diasSolicitados: number;
  /** Fechas específicas (YYYY-MM-DD) en que se toman los días. Vacío = registro viejo sin fechas. */
  fechas: string[];
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  // Relación (incluida en GET /dias-economicos y GET /dias-economicos/:id)
  personal?: IncidenciaEmpleadoRef;
}

export interface CreateDiaEconomicoPayload {
  personalId: number;
  anio: number;
  diasSolicitados: number;
  /** Fechas específicas (YYYY-MM-DD). Si se mandan, debe coincidir con diasSolicitados. */
  fechas?: string[];
  observaciones?: string;
}

// =================================================================
// Injustificantes (tab dentro de Personal)
// =================================================================

export interface Injustificante {
  id: number;
  personalId: number;
  /** YYYY-MM-DD */
  fecha: string;
  razon: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  // Relación (incluida en GET /injustificantes y GET /injustificantes/:id)
  personal?: IncidenciaEmpleadoRef;
}

export interface CreateInjustificantePayload {
  personalId: number;
  /** YYYY-MM-DD */
  fecha: string;
  razon: string;
}

// =================================================================
// Wrappers de respuesta
// =================================================================

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiOkPaginated<T> {
  ok: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

// =================================================================
// Payloads de creación / actualización
// =================================================================

export interface CreateCiudadanoPayload {
  curp?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  fechaNacimiento?: string;
  notas?: string;
}

export interface CreateSolicitudPayload {
  ciudadanoId: number;
  tramiteId: number;
  datos: Record<string, unknown>;
  precioFinal?: number;
  fechaAtencion?: string;
  observaciones?: string;
}

export interface RegistrarPagoPayload {
  folioPago: string;
  tipo?: TipoPago;
  monto: number;
  fechaPago: string;
  lugarPago?: string;
  observaciones?: string;
  registradoPorId?: number;
}

export interface CrearAutorizacionPayload {
  emitidoPorId?: number;
  fechaVencimiento?: string;
  considerandos?: string;
  observaciones?: string;
}

export interface ActualizarAutorizacionPayload {
  datos?: Record<string, unknown>;
  fechaVencimiento?: string;
  considerandos?: string;
  observaciones?: string;
}

// =================================================================
// Requisiciones
// =================================================================

export type Unidad =
  | "PIEZA"
  | "LITRO"
  | "GALON"
  | "KILO"
  | "CAJA"
  | "ROLLO"
  | "PAQUETE";

export const UNIDADES_LABEL: Record<Unidad, string> = {
  PIEZA: "Pieza",
  LITRO: "Litro",
  GALON: "Galón",
  KILO: "Kilo",
  CAJA: "Caja",
  ROLLO: "Rollo",
  PAQUETE: "Paquete",
};

export const UNIDADES = [
  "PIEZA",
  "LITRO",
  "GALON",
  "KILO",
  "CAJA",
  "ROLLO",
  "PAQUETE",
] as const;

export interface Requisicion {
  id: number;
  numero: string;
  concepto: string;
  /** Viene como string de Prisma (Decimal) */
  cantidad: string;
  unidad: Unidad;
  partida: string;
  /** YYYY-MM-DD */
  fechaSolicitud: string;
  observaciones: string | null;
  surtido: boolean;
  /** YYYY-MM-DD. Requerido si surtido=true. */
  fechaEntrega: string | null;
  esConsumible: boolean;
  /** Id del movimiento creado en Consumibles (si aplica). Para idempotencia. */
  consumibleMovimientoId: number | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequisicionPayload {
  numero: string;
  concepto: string;
  cantidad: number;
  unidad: Unidad;
  partida: string;
  /** YYYY-MM-DD */
  fechaSolicitud: string;
  observaciones?: string;
  surtido?: boolean;
  /** YYYY-MM-DD */
  fechaEntrega?: string;
  esConsumible?: boolean;
}

// =================================================================
// Consumibles
// =================================================================

export type TipoMovimientoConsumible = "ENTRADA" | "SALIDA";

export interface Consumible {
  id: number;
  concepto: string;
  unidad: Unidad;
  /** Stock actual (string de Prisma Decimal). */
  cantidadActual: string;
  imagen: string | null;
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  /** Solo en GET /:id */
  movimientos?: ConsumibleMovimiento[];
}

export interface CreateConsumiblePayload {
  concepto: string;
  unidad: Unidad;
  cantidadActual?: number;
  /** URL pública del archivo subido. null = borrar imagen actual. */
  imagen?: string | null;
  observaciones?: string;
}

export interface ConsumibleMovimiento {
  id: number;
  consumibleId: number;
  tipo: TipoMovimientoConsumible;
  /** string de Prisma Decimal. */
  cantidad: string;
  /** YYYY-MM-DD */
  fecha: string;
  requisicionId: number | null;
  personalId: number | null;
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  // Relations
  consumible?: { id: number; concepto: string; unidad: Unidad };
  personal?: {
    id: number;
    nombre: string;
    apellidos: string;
    puesto: string;
  } | null;
  requisicion?: { id: number; numero: string } | null;
}

export interface EntregarConsumiblePayload {
  personalId: number;
  cantidad: number;
  /** YYYY-MM-DD (opcional, default = hoy) */
  fecha?: string;
  observaciones?: string;
}

export interface ReponerConsumiblePayload {
  cantidad: number;
  /** YYYY-MM-DD (opcional, default = hoy) */
  fecha?: string;
  observaciones?: string;
}

// =================================================================
// Resguardos
// =================================================================

export type EstadoResguardo =
  | "EN_BODEGA"
  | "ASIGNADO"
  | "REPARACION"
  | "BAJA";

export const ESTADO_RESGUARDO_LABEL: Record<EstadoResguardo, string> = {
  EN_BODEGA: "En bodega",
  ASIGNADO: "Asignado",
  REPARACION: "En reparación",
  BAJA: "Baja",
};

export const ESTADO_RESGUARDO_CLASSES: Record<
  EstadoResguardo,
  { bg: string; text: string; border: string }
> = {
  EN_BODEGA: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  ASIGNADO: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  REPARACION: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  BAJA: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
  },
};

export interface Resguardo {
  id: number;
  tipo: string;
  marca: string;
  modelo: string | null;
  numeroSerie: string;
  /** URL pública del archivo subido (ej. "/uploads/resguardos/..."). null = borrar imagen. */
  imagen: string | null;
  descripcion: string | null;
  estado: EstadoResguardo;
  personalActualId: number | null;
  /** YYYY-MM-DD */
  fechaAsignacionActual: string | null;
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  personalActual?: {
    id: number;
    nombre: string;
    apellidos: string;
    puesto: string;
  } | null;
}

export interface CreateResguardoPayload {
  tipo: string;
  marca: string;
  modelo?: string;
  numeroSerie: string;
  imagen?: string | null;
  descripcion?: string;
  estado?: EstadoResguardo;
  observaciones?: string;
}

export interface ResguardoHistorial {
  id: number;
  resguardoId: number;
  personalId: number;
  /** YYYY-MM-DD */
  fechaAsignacion: string;
  /** YYYY-MM-DD. null = sigue asignado. */
  fechaDevolucion: string | null;
  motivo: string | null;
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  // Relations
  resguardo?: {
    id: number;
    tipo: string;
    marca: string;
    modelo: string | null;
    numeroSerie: string;
    imagen: string | null;
  };
  personal?: {
    id: number;
    nombre: string;
    apellidos: string;
    puesto: string;
  } | null;
}

export interface AsignarResguardoPayload {
  personalId: number;
  /** YYYY-MM-DD (opcional, default = hoy) */
  fechaAsignacion?: string;
  motivo?: string;
  observaciones?: string;
}

export interface DevolverResguardoPayload {
  /** YYYY-MM-DD (opcional, default = hoy) */
  fechaDevolucion?: string;
  motivo?: string;
  observaciones?: string;
}

export interface BajaResguardoPayload {
  motivo: string;
  observaciones?: string;
}

// =================================================================
// Dashboard
// =================================================================

export interface DashboardStats {
  ciudadanos: number;
  personal: number;
  tramites: number;
  /** Por estado (REGISTRADA, PENDIENTE_PAGO, etc.) + total */
  solicitudes: Record<string, number> & { total: number };
  /** Solicitudes en estados no terminales (no AUTORIZADA/RECHAZADA/CANCELADA) */
  solicitudesActivas: number;
  /** Personal del IMBIO que cumple años este mes */
  cumpleanosEsteMes: number;
  requisiciones: {
    pendientes: number;
    surtidas: number;
    total: number;
  };
  consumibles: {
    total: number;
    sinStock: number;
    stockBajo: number;
  };
  resguardos: {
    total: number;
    asignados: number;
    enBodega: number;
    baja: number;
  };
  areasVerdes: {
    proximos30Dias: number;
  };
}

export interface DashboardCumpleanos {
  id: number;
  nombre: string;
  apellidos: string;
  puesto: string;
  /** YYYY-MM-DD original */
  fechaNacimiento: string;
  /** YYYY-MM-DD del próximo cumple (puede ser del año próximo) */
  proximo: string;
  /** Días hasta el próximo cumple (0 = hoy, negativo = ya pasó en este año) */
  diasRestantes: number;
}

export interface DashboardCorrespondencia {
  id: number;
  numero: string;
  asunto: string;
  fechaMaximaRespuesta: string | null;
  diasRestantes: number | null;
  status: string;
  tipo: string;
  remitente: string;
}

export interface DashboardData {
  stats: DashboardStats;
  cumpleanosProximos: DashboardCumpleanos[];
  correspondenciaPendiente: DashboardCorrespondencia[];
  areasVerdesProximas: DashboardAreaVerde[];
  eventosCorrespondencia: DashboardEventoCorrespondencia[];
}

export interface DashboardAreaVerde {
  id: number;
  areaVerde: string;
  usuario: string;
  tipoEvento: string;
  /** YYYY-MM-DD */
  fecha: string;
  horaInicio: string;
  horaFin: string;
  responsable: string;
  diasRestantes: number;
}

export interface DashboardEventoCorrespondencia {
  id: number;
  numero: string;
  asunto: string;
  tipo: string;
  status: string;
  /** YYYY-MM-DD[] — fechas del evento (ordenadas) */
  fechasEvento: string[];
  /** IDs de personal asistente */
  asistentesIds: number[];
  /** Info completa de los asistentes (name, puesto) */
  asistentes: Array<{
    id: number;
    nombre: string;
    apellidos: string;
    puesto: string;
  }>;
  /** Días hasta el evento más próximo (null si no hay eventos futuros) */
  diasRestantes: number | null;
}

// =================================================================
// Health
// =================================================================

export interface HealthInfo {
  ok: true;
  service: string;
  database?: "up" | "down";
  timestamp: string;
}

export interface ServerInfo {
  ok: true;
  version: string;
  institucion: string;
  tramitesActivos: number;
  ciudadanosRegistrados: number;
}

export interface NetworkInterface {
  name: string;
  address: string;
  family: "IPv4" | "IPv6";
  internal: boolean;
}

export interface NetworkInfo {
  ok: true;
  host: string;
  port: number;
  interfaces: NetworkInterface[];
  lanIps: string[];
  urls: string[];
  hint: string;
}
