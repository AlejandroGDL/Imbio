/**
 * Cliente HTTP para el backend IMBIO.
 * Lee la URL del server dinámicamente desde la configuración.
 */

import { getServerUrl } from "./config";
import type {
  ApiResponse,
  AreaVerde,
  Ciudadano,
  Configuracion,
  Correspondencia,
  CreateAreaVerdePayload,
  CreateCiudadanoPayload,
  CreateCorrespondenciaPayload,
  CreateIncidenciaPayload,
  CreatePersonalPayload,
  CreateSolicitudPayload,
  CreateVacacionPayload,
  CreateDiaEconomicoPayload,
  CreateInjustificantePayload,
  CrearAutorizacionPayload,
  ActualizarAutorizacionPayload,
  Autorizacion,
  DiaEconomico,
  EstadoSolicitud,
  HealthInfo,
  Incidencia,
  Injustificante,
  Pago,
  Personal,
  RegistrarPagoPayload,
  Requisicion,
  Consumible,
  ConsumibleMovimiento,
  CreateRequisicionPayload,
  CreateConsumiblePayload,
  EntregarConsumiblePayload,
  ReponerConsumiblePayload,
  DashboardData,
  Resguardo,
  ResguardoHistorial,
  CreateResguardoPayload,
  AsignarResguardoPayload,
  DevolverResguardoPayload,
  BajaResguardoPayload,
  ServerInfo,
  NetworkInfo,
  Solicitud,
  StatusCorrespondencia,
  TipoIncidencia,
  Tramite,
  Vacacion,
} from "@/types/api";
import { AREAS_VERDES_OPCIONES } from "@/types/api";

const DEFAULT_TIMEOUT = 15_000; // 15s

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Usuario autenticado (devuelto por /auth/me y /auth/login). */
export interface AuthUser {
  id: number;
  username: string;
  nombre: string;
  email: string | null;
  rol: "ADMIN" | "OPERADOR" | "TECNICO";
  activo?: boolean;
  ultimoAcceso: string | null;
  createdAt?: string;
  updatedAt?: string;
}

class ApiClient {
  /**
   * Hace un request al backend.
   * Lanza ApiError si la respuesta no es OK.
   * Devuelve el body completo parseado (cada método extrae lo que necesita).
   *
   * SIEMPRE envía `credentials: "include"` para que el navegador
   * incluya la cookie de sesión HttpOnly (`imbio_token`) en cada
   * petición.
   */
  async request<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const baseUrl = getServerUrl();
    const url = `${baseUrl}${path.startsWith("/") ? path : "/" + path}`;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      options.signal ? DEFAULT_TIMEOUT : DEFAULT_TIMEOUT,
    );

    try {
      // Solo agregar Content-Type cuando hay body (POST/PUT/PATCH).
      // En GET/DELETE no se manda para evitar problemas con algunos servers.
      // Si el body es FormData, NO poner Content-Type — el browser lo agrega
      // automáticamente con el boundary correcto.
      const hasBody = options.body !== undefined && options.body !== null;
      const isFormData = options.body instanceof FormData;
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
      };
      if (hasBody && !isFormData && !headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, {
        ...options,
        // Fundamental para que el navegador envíe la cookie HttpOnly
        // y para que la acepte de vuelta.
        credentials: "include",
        signal: options.signal ?? controller.signal,
        headers,
      });

      window.clearTimeout(timeoutId);

      // Parsea el JSON (puede ser ApiOk o ApiError)
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new ApiError(
          res.status,
          "PARSE_ERROR",
          `Respuesta no es JSON válido (${res.status})`,
        );
      }

      if (!res.ok || (body as ApiResponse<unknown>)?.ok === false) {
        const errBody = body as ApiResponse<unknown>;
        const err = (errBody as { error?: { code: string; message: string; details?: unknown } }).error;
        throw new ApiError(
          res.status,
          err?.code ?? "HTTP_ERROR",
          err?.message ?? `HTTP ${res.status}`,
          err?.details,
        );
      }

      // Devuelve el body completo — cada método extrae lo que necesita
      return body as T;
    } catch (err) {
      window.clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError(0, "TIMEOUT", "La petición tardó demasiado");
      }
      // Error de red (server caído, CORS, DNS, etc.)
      throw new ApiError(
        0,
        "NETWORK",
        err instanceof Error ? err.message : "Error de red",
      );
    }
  }

  // =================================================================
  // Health (no tienen wrapper {data}, devuelven el body directo)
  // =================================================================
  async health(): Promise<HealthInfo> {
    return this.request<HealthInfo>("/health");
  }

  // =================================================================
  // Auth (login / logout / me / changePassword)
  // =================================================================
  /**
   * Inicia sesión. Si las credenciales son correctas, el backend
   * setea una cookie HttpOnly (`imbio_token`) que el navegador
   * incluirá automáticamente en las próximas peticiones.
   */
  async login(username: string, password: string): Promise<AuthUser> {
    const body = await this.request<{ ok: true; data: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return body.data;
  }

  /** Cierra la sesión actual (limpia la cookie HttpOnly). */
  async logout(): Promise<{ loggedOut: true }> {
    const body = await this.request<{ ok: true; data: { loggedOut: true } }>(
      "/auth/logout",
      { method: "POST" },
    );
    return body.data;
  }

  /** Devuelve el usuario actual o lanza 401 si no hay sesión. */
  async me(): Promise<AuthUser> {
    const body = await this.request<{ ok: true; data: AuthUser }>("/auth/me");
    return body.data;
  }

  /**
   * Cambia la contraseña del usuario actual. Requiere la contraseña
   * actual para confirmar.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request<{ ok: true; data: { changed: true } }>(
      "/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );
  }

  // =================================================================
  // Usuarios (solo ADMIN)
  // =================================================================
  async listarUsuarios(params: {
    q?: string;
    rol?: "ADMIN" | "OPERADOR" | "TECNICO";
    activo?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: AuthUser[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.rol) search.set("rol", params.rol);
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const body = await this.request<{
      ok: true;
      data: AuthUser[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/usuarios?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async crearUsuario(payload: {
    username: string;
    password: string;
    nombre: string;
    email?: string;
    rol: "ADMIN" | "OPERADOR" | "TECNICO";
    activo?: boolean;
  }): Promise<AuthUser> {
    const body = await this.request<{ ok: true; data: AuthUser }>("/usuarios", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return body.data;
  }

  async actualizarUsuario(
    id: number,
    payload: {
      nombre?: string;
      email?: string;
      rol?: "ADMIN" | "OPERADOR" | "TECNICO";
      activo?: boolean;
      password?: string;
    },
  ): Promise<AuthUser> {
    const body = await this.request<{ ok: true; data: AuthUser }>(
      `/usuarios/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarUsuario(id: number): Promise<{ id: number; activo: boolean }> {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/usuarios/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  async healthDb(): Promise<HealthInfo> {
    return this.request<HealthInfo>("/health/db");
  }

  async info(): Promise<ServerInfo> {
    return this.request<ServerInfo>("/info");
  }

  async network(): Promise<NetworkInfo> {
    return this.request<NetworkInfo>("/network");
  }

  // =================================================================
  // Ciudadanos
  // =================================================================
  async listarCiudadanos(params: {
    q?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Ciudadano[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Ciudadano[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/ciudadanos?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerCiudadano(id: number) {
    const body = await this.request<{ ok: true; data: Ciudadano & { solicitudes?: Solicitud[] } }>(
      `/ciudadanos/${id}`,
    );
    return body.data;
  }

  async buscarPorCurp(curp: string) {
    const body = await this.request<{ ok: true; data: Ciudadano }>(
      `/ciudadanos/curp/${encodeURIComponent(curp)}`,
    );
    return body.data;
  }

  async crearCiudadano(payload: CreateCiudadanoPayload) {
    const body = await this.request<{ ok: true; data: Ciudadano }>(
      "/ciudadanos",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarCiudadano(id: number, payload: Partial<CreateCiudadanoPayload>) {
    const body = await this.request<{ ok: true; data: Ciudadano }>(
      `/ciudadanos/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarCiudadano(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/ciudadanos/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Trámites
  // =================================================================
  async listarTramites(params: {
    categoria?: string;
    activo?: boolean;
    q?: string;
  } = {}): Promise<Tramite[]> {
    const search = new URLSearchParams();
    if (params.categoria) search.set("categoria", params.categoria);
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    if (params.q) search.set("q", params.q);
    const body = await this.request<{ ok: true; data: Tramite[] }>(
      `/tramites?${search.toString()}`,
    );
    return body.data;
  }

  async obtenerTramite(idOrCodigo: string | number) {
    const body = await this.request<{ ok: true; data: Tramite }>(
      `/tramites/${idOrCodigo}`,
    );
    return body.data;
  }

  /**
   * Devuelve los valores únicos de marca y modelo ya registrados
   * en solicitudes de Traslado de Leña, ordenados por frecuencia
   * (los más usados primero). Se usa para el autocompletado del form.
   */
  async listarMarcasModelos(): Promise<{ marcas: string[]; modelos: string[] }> {
    const body = await this.request<{
      ok: true;
      data: { marcas: string[]; modelos: string[] };
    }>(`/solicitudes/marcas-modelos`);
    return body.data;
  }

  async crearTramite(payload: {
    codigo: string;
    nombre: string;
    descripcion?: string;
    categoria: string;
    campos: unknown[];
    precioBase?: number;
    reglaPrecio?: unknown;
    requierePago?: boolean;
    orden?: number;
    activo?: boolean;
  }) {
    const body = await this.request<{ ok: true; data: Tramite }>(
      "/tramites",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarTramite(
    id: number,
    payload: Partial<{
      codigo: string;
      nombre: string;
      descripcion: string;
      categoria: string;
      campos: unknown[];
      precioBase: number;
      reglaPrecio: unknown;
      requierePago: boolean;
      orden: number;
      activo: boolean;
    }>,
  ) {
    const body = await this.request<{ ok: true; data: Tramite }>(
      `/tramites/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarTramite(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/tramites/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Solicitudes
  // =================================================================
  async listarSolicitudes(params: {
    estado?: EstadoSolicitud;
    tramiteId?: number;
    tramiteCodigo?: string;
    categoria?: "PERMISO" | "SERVICIO" | "SANCION";
    ciudadanoId?: number;
    q?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        search.set(k, String(v));
      }
    });
    const body = await this.request<{
      ok: true;
      data: (Solicitud & {
        ciudadano: Pick<Ciudadano, "id" | "nombre" | "apellidoPaterno" | "apellidoMaterno" | "curp" | "telefono">;
        tramite: Pick<Tramite, "id" | "codigo" | "nombre" | "categoria">;
        pago: Pago | null;
        autorizacion: Solicitud["autorizacion"];
      })[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/solicitudes?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerSolicitud(idOrFolio: string | number) {
    const body = await this.request<{ ok: true; data: Solicitud }>(
      `/solicitudes/${idOrFolio}`,
    );
    return body.data;
  }

  async crearSolicitud(payload: CreateSolicitudPayload) {
    const body = await this.request<{ ok: true; data: Solicitud }>(
      "/solicitudes",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarSolicitud(
    id: number,
    payload: { datos?: Record<string, unknown>; precioFinal?: number; observaciones?: string },
  ) {
    const body = await this.request<{ ok: true; data: Solicitud }>(
      `/solicitudes/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async cambiarEstadoSolicitud(
    id: number,
    estado: EstadoSolicitud,
    motivo?: string,
  ) {
    const body = await this.request<{ ok: true; data: Solicitud }>(
      `/solicitudes/${id}/estado`,
      {
        method: "POST",
        body: JSON.stringify({ estado, motivo }),
      },
    );
    return body.data;
  }

  async registrarPago(solicitudId: number, payload: RegistrarPagoPayload) {
    const body = await this.request<{ ok: true; data: { pago: Pago; solicitud: Solicitud } }>(
      `/solicitudes/${solicitudId}/pago`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async crearAutorizacion(solicitudId: number, payload: CrearAutorizacionPayload) {
    const body = await this.request<{
      ok: true;
      data: {
        autorizacion: Solicitud["autorizacion"];
        solicitud: Solicitud;
        pdfGenerado: boolean;
      };
    }>(
      `/solicitudes/${solicitudId}/autorizacion`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async obtenerAutorizacion(id: number) {
    const body = await this.request<{
      ok: true;
      data: Autorizacion & {
        solicitud: Solicitud;
        emitidoPor: Solicitud["autorizacion"] extends infer A
          ? A extends { emitidoPor?: infer EP }
            ? EP
            : null
          : null;
        tienePdf: boolean;
      };
    }>(`/autorizaciones/${id}`);
    return body.data;
  }

  async actualizarAutorizacion(
    id: number,
    payload: ActualizarAutorizacionPayload,
  ) {
    const body = await this.request<{
      ok: true;
      data: Autorizacion & { solicitud: Solicitud; emitidoPor: unknown; tienePdf: boolean };
      pdfRegenerado: boolean;
    }>(`/autorizaciones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return body;
  }

  async eliminarSolicitud(id: number) {
    const body = await this.request<{
      ok: true;
      data: {
        id: number;
        deleted: boolean;
        pagoBorrado?: boolean;
        autorizacionBorrada?: boolean;
        estadoAnterior?: string;
      };
    }>(`/solicitudes/${id}`, { method: "DELETE" });
    return body.data;
  }

  // =================================================================
  // Configuración
  // =================================================================
  async getConfiguracion(): Promise<Configuracion> {
    const body = await this.request<{ ok: true; data: Configuracion }>(
      "/configuracion",
    );
    return body.data;
  }

  async updateConfiguracion(
    payload: Partial<{
      nombreInstitucion: string;
      direccion: string | null;
      telefono: string | null;
      email: string | null;
      sitioWeb: string | null;
      piePaginaAutorizacion: string | null;
      vvuma: number | null;
    }>,
  ): Promise<Configuracion> {
    const body = await this.request<{ ok: true; data: Configuracion }>(
      "/configuracion",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  // =================================================================
  // Áreas Verdes
  // =================================================================
  async listarAreasVerdesOpciones(): Promise<string[]> {
    // Intenta leer del backend (que es la fuente de verdad); si falla,
    // usa la constante local como fallback.
    try {
      const body = await this.request<{ ok: true; data: string[] }>(
        "/areas-verdes/opciones",
      );
      return body.data;
    } catch {
      return [...AREAS_VERDES_OPCIONES];
    }
  }

  async listarAreasVerdes(params: {
    q?: string;
    areaVerde?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: AreaVerde[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.areaVerde) search.set("areaVerde", params.areaVerde);
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: AreaVerde[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/areas-verdes?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerAreaVerde(id: number): Promise<AreaVerde> {
    const body = await this.request<{ ok: true; data: AreaVerde }>(
      `/areas-verdes/${id}`,
    );
    return body.data;
  }

  async crearAreaVerde(payload: CreateAreaVerdePayload): Promise<AreaVerde> {
    const body = await this.request<{ ok: true; data: AreaVerde }>(
      "/areas-verdes",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarAreaVerde(
    id: number,
    payload: Partial<CreateAreaVerdePayload>,
  ): Promise<AreaVerde> {
    const body = await this.request<{ ok: true; data: AreaVerde }>(
      `/areas-verdes/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarAreaVerde(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/areas-verdes/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  /**
   * Devuelve la URL del PDF del permiso de área verde. La URL
   * apunta al backend, que sirve el archivo con Content-Type:
   * application/pdf y Cache-Control: no-store. Útil para abrir
   * en nueva pestaña o descargar.
   *
   * Si el área verde aún no tiene `folioPermiso`, el backend lo
   * genera y guarda en la primera petición (lazy gen).
   *
   * @param id ID del área verde
   * @param cacheBuster Si true, agrega `?_t={timestamp}` para forzar
   *   al navegador a recargar (útil al regenerar tras editar).
   */
  getPermisoAreaVerdePdfUrl(id: number, cacheBuster = false): string {
    const base = `${getServerUrl()}/areas-verdes/${id}/permiso/pdf`;
    if (cacheBuster) {
      return `${base}?_t=${Date.now()}`;
    }
    return base;
  }

  // =================================================================
  // Correspondencia
  // =================================================================
  async listarCorrespondencias(params: {
    q?: string;
    tipo?: "ENTRADA" | "SALIDA";
    tipoDocumento?: "MEMORANDUM" | "OFICIO";
    status?: StatusCorrespondencia;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
    ocupaRespuesta?: boolean;
    asisteAEvento?: boolean;
  } = {}): Promise<{
    data: Correspondencia[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.tipo) search.set("tipo", params.tipo);
    if (params.tipoDocumento) search.set("tipoDocumento", params.tipoDocumento);
    if (params.status) search.set("status", params.status);
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    if (params.ocupaRespuesta !== undefined)
      search.set("ocupaRespuesta", String(params.ocupaRespuesta));
    if (params.asisteAEvento !== undefined)
      search.set("asisteAEvento", String(params.asisteAEvento));
    const body = await this.request<{
      ok: true;
      data: Correspondencia[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/correspondencias?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerCorrespondencia(id: number): Promise<Correspondencia> {
    const body = await this.request<{ ok: true; data: Correspondencia }>(
      `/correspondencias/${id}`,
    );
    return body.data;
  }

  async crearCorrespondencia(
    payload: CreateCorrespondenciaPayload,
  ): Promise<Correspondencia> {
    const body = await this.request<{ ok: true; data: Correspondencia }>(
      "/correspondencias",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarCorrespondencia(
    id: number,
    payload: Partial<CreateCorrespondenciaPayload>,
  ): Promise<Correspondencia> {
    const body = await this.request<{ ok: true; data: Correspondencia }>(
      `/correspondencias/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async cambiarStatusCorrespondencia(
    id: number,
    status: StatusCorrespondencia,
  ): Promise<Correspondencia> {
    const body = await this.request<{ ok: true; data: Correspondencia }>(
      `/correspondencias/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );
    return body.data;
  }

  async eliminarCorrespondencia(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/correspondencias/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Personal
  // =================================================================
  async listarPersonal(params: {
    q?: string;
    tipo?: "CONFIANZA" | "SINDICALIZADO";
    puesto?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Personal[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.tipo) search.set("tipo", params.tipo);
    if (params.puesto) search.set("puesto", params.puesto);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Personal[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/personal?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerPersonal(id: number): Promise<Personal> {
    const body = await this.request<{ ok: true; data: Personal }>(
      `/personal/${id}`,
    );
    return body.data;
  }

  async crearPersonal(payload: CreatePersonalPayload): Promise<Personal> {
    const body = await this.request<{ ok: true; data: Personal }>(
      "/personal",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarPersonal(
    id: number,
    payload: Partial<CreatePersonalPayload>,
  ): Promise<Personal> {
    const body = await this.request<{ ok: true; data: Personal }>(
      `/personal/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarPersonal(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/personal/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Incidencias (tab dentro de Personal)
  // =================================================================
  async listarIncidencias(params: {
    q?: string;
    personalId?: number;
    tipo?: TipoIncidencia;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Incidencia[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.personalId) search.set("personalId", String(params.personalId));
    if (params.tipo) search.set("tipo", params.tipo);
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Incidencia[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/incidencias?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerIncidencia(id: number): Promise<Incidencia> {
    const body = await this.request<{ ok: true; data: Incidencia }>(
      `/incidencias/${id}`,
    );
    return body.data;
  }

  async crearIncidencia(payload: CreateIncidenciaPayload): Promise<Incidencia> {
    const body = await this.request<{ ok: true; data: Incidencia }>(
      "/incidencias",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarIncidencia(
    id: number,
    payload: Partial<CreateIncidenciaPayload>,
  ): Promise<Incidencia> {
    const body = await this.request<{ ok: true; data: Incidencia }>(
      `/incidencias/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarIncidencia(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/incidencias/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Vacaciones (tab dentro de Personal)
  // =================================================================
  async listarVacaciones(params: {
    q?: string;
    personalId?: number;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Vacacion[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.personalId) search.set("personalId", String(params.personalId));
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Vacacion[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/vacaciones?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerVacacion(id: number): Promise<Vacacion> {
    const body = await this.request<{ ok: true; data: Vacacion }>(
      `/vacaciones/${id}`,
    );
    return body.data;
  }

  async crearVacacion(payload: CreateVacacionPayload): Promise<Vacacion> {
    const body = await this.request<{ ok: true; data: Vacacion }>(
      "/vacaciones",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarVacacion(
    id: number,
    payload: Partial<CreateVacacionPayload>,
  ): Promise<Vacacion> {
    const body = await this.request<{ ok: true; data: Vacacion }>(
      `/vacaciones/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarVacacion(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/vacaciones/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Días Económicos (tab dentro de Personal, exclusivo Sindicalizados)
  // =================================================================
  async listarDiasEconomicos(params: {
    q?: string;
    personalId?: number;
    anio?: number;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: DiaEconomico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.personalId) search.set("personalId", String(params.personalId));
    if (params.anio) search.set("anio", String(params.anio));
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: DiaEconomico[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/dias-economicos?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerDiaEconomico(id: number): Promise<DiaEconomico> {
    const body = await this.request<{ ok: true; data: DiaEconomico }>(
      `/dias-economicos/${id}`,
    );
    return body.data;
  }

  async crearDiaEconomico(payload: CreateDiaEconomicoPayload): Promise<DiaEconomico> {
    const body = await this.request<{ ok: true; data: DiaEconomico }>(
      "/dias-economicos",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarDiaEconomico(
    id: number,
    payload: Partial<CreateDiaEconomicoPayload>,
  ): Promise<DiaEconomico> {
    const body = await this.request<{ ok: true; data: DiaEconomico }>(
      `/dias-economicos/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarDiaEconomico(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/dias-economicos/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Injustificantes (tab dentro de Personal)
  // =================================================================
  async listarInjustificantes(params: {
    q?: string;
    personalId?: number;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Injustificante[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.personalId) search.set("personalId", String(params.personalId));
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Injustificante[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/injustificantes?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerInjustificante(id: number): Promise<Injustificante> {
    const body = await this.request<{ ok: true; data: Injustificante }>(
      `/injustificantes/${id}`,
    );
    return body.data;
  }

  async crearInjustificante(
    payload: CreateInjustificantePayload,
  ): Promise<Injustificante> {
    const body = await this.request<{ ok: true; data: Injustificante }>(
      "/injustificantes",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async actualizarInjustificante(
    id: number,
    payload: Partial<CreateInjustificantePayload>,
  ): Promise<Injustificante> {
    const body = await this.request<{ ok: true; data: Injustificante }>(
      `/injustificantes/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return body.data;
  }

  async eliminarInjustificante(id: number) {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/injustificantes/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // PDF de autorización
  // =================================================================
  /**
   * Devuelve la URL del PDF de una autorización. La URL apunta al
   * backend que sirve el archivo con Content-Type: application/pdf.
   * Útil para abrir en nueva pestaña o descargar.
   */
  getPdfUrl(autorizacionId: number): string {
    return `${getServerUrl()}/autorizaciones/${autorizacionId}/pdf`;
  }

  // =================================================================
  // Uploads
  // =================================================================
  /**
   * Sube un archivo al backend y devuelve la URL pública.
   * @param file Archivo a subir
   * @param subdir Subcarpeta destino (default: "consumibles")
   */
  async subirImagen(
    file: File,
    subdir: "consumibles" | "resguardos" | "personal" = "consumibles",
  ): Promise<{ url: string; filename: string; size: number; mime: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const body = await this.request<{
      ok: true;
      data: { url: string; filename: string; size: number; mime: string };
    }>(`/uploads?subdir=${subdir}`, {
      method: "POST",
      body: formData,
    });
    return body.data;
  }

  // =================================================================
  // Requisiciones
  // =================================================================
  async listarRequisiciones(params: {
    q?: string;
    surtido?: boolean;
    esConsumible?: boolean;
    unidad?: "PIEZA" | "LITRO" | "GALON" | "KILO" | "CAJA" | "ROLLO" | "PAQUETE";
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Requisicion[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.surtido !== undefined) search.set("surtido", String(params.surtido));
    if (params.esConsumible !== undefined)
      search.set("esConsumible", String(params.esConsumible));
    if (params.unidad) search.set("unidad", params.unidad);
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Requisicion[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/requisiciones?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerRequisicion(id: number): Promise<Requisicion> {
    const body = await this.request<{ ok: true; data: Requisicion }>(
      `/requisiciones/${id}`,
    );
    return body.data;
  }

  async crearRequisicion(
    payload: CreateRequisicionPayload,
  ): Promise<Requisicion> {
    const body = await this.request<{ ok: true; data: Requisicion }>(
      "/requisiciones",
      { method: "POST", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async actualizarRequisicion(
    id: number,
    payload: Partial<CreateRequisicionPayload>,
  ): Promise<Requisicion> {
    const body = await this.request<{ ok: true; data: Requisicion }>(
      `/requisiciones/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async eliminarRequisicion(id: number): Promise<{ id: number; activo: boolean }> {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/requisiciones/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  // =================================================================
  // Consumibles
  // =================================================================
  async listarConsumibles(params: {
    q?: string;
    unidad?: "PIEZA" | "LITRO" | "GALON" | "KILO" | "CAJA" | "ROLLO" | "PAQUETE";
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Consumible[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.unidad) search.set("unidad", params.unidad);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Consumible[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/consumibles?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerConsumible(id: number): Promise<Consumible> {
    const body = await this.request<{ ok: true; data: Consumible }>(
      `/consumibles/${id}`,
    );
    return body.data;
  }

  async crearConsumible(payload: CreateConsumiblePayload): Promise<Consumible> {
    const body = await this.request<{ ok: true; data: Consumible }>(
      "/consumibles",
      { method: "POST", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async actualizarConsumible(
    id: number,
    payload: Partial<CreateConsumiblePayload>,
  ): Promise<Consumible> {
    const body = await this.request<{ ok: true; data: Consumible }>(
      `/consumibles/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async eliminarConsumible(id: number): Promise<{ id: number; activo: boolean }> {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/consumibles/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  async entregarConsumible(
    id: number,
    payload: EntregarConsumiblePayload,
  ): Promise<{ movimiento: ConsumibleMovimiento; consumible: Consumible }> {
    const body = await this.request<{
      ok: true;
      data: { movimiento: ConsumibleMovimiento; consumible: Consumible };
    }>(`/consumibles/${id}/entregar`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return body.data;
  }

  async reponerConsumible(
    id: number,
    payload: ReponerConsumiblePayload,
  ): Promise<{ movimiento: ConsumibleMovimiento; consumible: Consumible }> {
    const body = await this.request<{
      ok: true;
      data: { movimiento: ConsumibleMovimiento; consumible: Consumible };
    }>(`/consumibles/${id}/reponer`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return body.data;
  }

  async listarMovimientosConsumibles(params: {
    q?: string;
    personalId?: number;
    tipo?: "ENTRADA" | "SALIDA";
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: ConsumibleMovimiento[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.personalId) search.set("personalId", String(params.personalId));
    if (params.tipo) search.set("tipo", params.tipo);
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const body = await this.request<{
      ok: true;
      data: ConsumibleMovimiento[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/consumibles/movimientos?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  // =================================================================
  // Dashboard
  // =================================================================
  async obtenerDashboard(): Promise<DashboardData> {
    const body = await this.request<{ ok: true; data: DashboardData }>(
      "/dashboard",
    );
    return body.data;
  }

  // =================================================================
  // Resguardos
  // =================================================================
  async listarResguardos(params: {
    q?: string;
    tipo?: string;
    estado?: "EN_BODEGA" | "ASIGNADO" | "REPARACION" | "BAJA";
    personalId?: number;
    page?: number;
    limit?: number;
    activo?: boolean;
  } = {}): Promise<{
    data: Resguardo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.tipo) search.set("tipo", params.tipo);
    if (params.estado) search.set("estado", params.estado);
    if (params.personalId) search.set("personalId", String(params.personalId));
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    if (params.activo !== undefined) search.set("activo", String(params.activo));
    const body = await this.request<{
      ok: true;
      data: Resguardo[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/resguardos?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }

  async obtenerResguardo(id: number): Promise<Resguardo> {
    const body = await this.request<{ ok: true; data: Resguardo }>(
      `/resguardos/${id}`,
    );
    return body.data;
  }

  async crearResguardo(payload: CreateResguardoPayload): Promise<Resguardo> {
    const body = await this.request<{ ok: true; data: Resguardo }>(
      "/resguardos",
      { method: "POST", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async actualizarResguardo(
    id: number,
    payload: Partial<CreateResguardoPayload>,
  ): Promise<Resguardo> {
    const body = await this.request<{ ok: true; data: Resguardo }>(
      `/resguardos/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async eliminarResguardo(id: number): Promise<{ id: number; activo: boolean }> {
    const body = await this.request<{ ok: true; data: { id: number; activo: boolean } }>(
      `/resguardos/${id}`,
      { method: "DELETE" },
    );
    return body.data;
  }

  async asignarResguardo(
    id: number,
    payload: AsignarResguardoPayload,
  ): Promise<{ hist: ResguardoHistorial; upd: Resguardo }> {
    const body = await this.request<{
      ok: true;
      data: { hist: ResguardoHistorial; upd: Resguardo };
    }>(`/resguardos/${id}/asignar`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return body.data;
  }

  async devolverResguardo(
    id: number,
    payload: DevolverResguardoPayload = {},
  ): Promise<Resguardo> {
    const body = await this.request<{ ok: true; data: Resguardo }>(
      `/resguardos/${id}/devolver`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async darBajaResguardo(
    id: number,
    payload: BajaResguardoPayload,
  ): Promise<Resguardo> {
    const body = await this.request<{ ok: true; data: Resguardo }>(
      `/resguardos/${id}/baja`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    return body.data;
  }

  async historialResguardo(
    id: number,
    params: { page?: number; limit?: number } = {},
  ): Promise<{
    data: ResguardoHistorial[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const qs = search.toString() ? `?${search.toString()}` : "";
    const body = await this.request<{
      ok: true;
      data: ResguardoHistorial[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/resguardos/${id}/historial${qs}`);
    return { data: body.data, pagination: body.pagination };
  }

  async historialGlobalResguardos(params: {
    personalId?: number;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: ResguardoHistorial[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params.personalId) search.set("personalId", String(params.personalId));
    if (params.desde) search.set("desde", params.desde);
    if (params.hasta) search.set("hasta", params.hasta);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const body = await this.request<{
      ok: true;
      data: ResguardoHistorial[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/resguardos-historial/movimientos?${search.toString()}`);
    return { data: body.data, pagination: body.pagination };
  }
}

export const api = new ApiClient();
export type { Configuracion };
