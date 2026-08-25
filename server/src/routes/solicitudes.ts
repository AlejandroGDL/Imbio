import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { EstadoSolicitud, Prisma } from "@prisma/client";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";
import { generarFolioSolicitud, generarNumeroAutorizacion } from "../lib/folios";
import {
  calcularPrecioPoda,
  calcularPrecioDerribo,
  calcularPrecioServicioPoda,
  calcularPrecioServicioDerribo,
  calcularPrecioUsoContenedores,
  calcularVencimientoContenedor,
  obtenerVvuma,
} from "../lib/precios";
import { debeGenerarPdf, generarPdfAutorizacion } from "../lib/pdf";

const listQuerySchema = z.object({
  estado: z.nativeEnum(EstadoSolicitud).optional(),
  tramiteId: z.coerce.number().int().optional(),
  tramiteCodigo: z.string().trim().optional(),
  categoria: z.enum(["PERMISO", "SERVICIO", "SANCION"]).optional(),
  ciudadanoId: z.coerce.number().int().optional(),
  q: z.string().trim().optional(), // busca por folio, nombre, CURP
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const createSchema = z.object({
  ciudadanoId: z.number().int().positive(),
  tramiteId: z.number().int().positive(),
  // datos: opcional. Puede ser {} al crear — los campos dinámicos
  // se completan después, en la fase de autorización.
  datos: z.record(z.any()).optional().default({}),
  precioFinal: z.number().nonnegative().optional().nullable(),
  fechaAtencion: z.string().optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
});

const updateDatosSchema = z.object({
  datos: z.record(z.any()).optional(),
  precioFinal: z.number().nonnegative().optional().nullable(),
  fechaAtencion: z.string().optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
});

const updateEstadoSchema = z.object({
  estado: z.nativeEnum(EstadoSolicitud),
  motivo: z.string().trim().optional(), // para RECHAZADA / CANCELADA
});

const pagoSchema = z.object({
  folioPago: z.string().trim().min(1, "Folio de pago requerido"),
  tipo: z.enum(["MEMORANDUM", "EFECTIVO", "TRANSFERENCIA", "OTRO"]).default("MEMORANDUM"),
  monto: z.number().nonnegative(),
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  lugarPago: z.string().trim().optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
  registradoPorId: z.number().int().optional().nullable(),
});

const autorizacionSchema = z.object({
  emitidoPorId: z.number().int().optional().nullable(),
  fechaVencimiento: z.string().optional().nullable(),
  considerandos: z.string().trim().optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
});

export async function solicitudesRoutes(app: FastifyInstance) {
  // =================================================================
  // Listar
  // =================================================================
  app.get("/solicitudes", async (request, reply) => {
    try {
      const params = listQuerySchema.parse(request.query);

      // Si pasan tramiteCodigo, resolvemos el id
      let tramiteId = params.tramiteId;
      if (!tramiteId && params.tramiteCodigo) {
        const t = await prisma.tramite.findUnique({
          where: { codigo: params.tramiteCodigo.toUpperCase() },
          select: { id: true },
        });
        tramiteId = t?.id;
      }

      // Si pasan categoria, resolvemos todos los ids de trámites de esa categoría
      let tramiteIds: number[] | undefined;
      if (params.categoria) {
        const tramites = await prisma.tramite.findMany({
          where: { categoria: params.categoria, activo: true },
          select: { id: true },
        });
        tramiteIds = tramites.map((t) => t.id);
      }

      const where: Prisma.SolicitudWhereInput = {
        ...(params.estado ? { estado: params.estado } : {}),
        ...(tramiteId ? { tramiteId } : {}),
        ...(tramiteIds ? { tramiteId: { in: tramiteIds } } : {}),
        ...(params.ciudadanoId ? { ciudadanoId: params.ciudadanoId } : {}),
        ...(params.desde || params.hasta
          ? {
              fechaSolicitud: {
                ...(params.desde ? { gte: new Date(params.desde) } : {}),
                ...(params.hasta ? { lte: new Date(params.hasta) } : {}),
              },
            }
          : {}),
        ...(params.q
          ? {
              OR: [
                { folio: { contains: params.q, mode: "insensitive" } },
                {
                  ciudadano: {
                    OR: [
                      {
                        nombre: {
                          contains: params.q,
                          mode: "insensitive",
                        },
                      },
                      {
                        apellidoPaterno: {
                          contains: params.q,
                          mode: "insensitive",
                        },
                      },
                      { curp: { contains: params.q.toUpperCase() } },
                    ],
                  },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.solicitud.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (params.page - 1) * params.limit,
          take: params.limit,
          include: {
            ciudadano: {
              select: {
                id: true,
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
                curp: true,
                telefono: true,
              },
            },
            tramite: { select: { id: true, codigo: true, nombre: true, categoria: true } },
            pago: true,
            autorizacion: true,
          },
        }),
        prisma.solicitud.count({ where }),
      ]);

      return {
        ok: true,
        data: items,
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
        },
      };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // =================================================================
  // Obtener una
  // =================================================================
  app.get<{ Params: { idOrFolio: string } }>(
    "/solicitudes/:idOrFolio",
    async (request, reply) => {
      try {
        const key = request.params.idOrFolio;
        const where = Number.isFinite(Number(key))
          ? { id: Number(key) }
          : { folio: key.toUpperCase() };

        const solicitud = await prisma.solicitud.findUnique({
          where,
          include: {
            ciudadano: true,
            tramite: true,
            pago: true,
            autorizacion: { include: { emitidoPor: true } },
          },
        });
        if (!solicitud) throw errors.notFound("Solicitud", key);
        return { ok: true, data: solicitud };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // =================================================================
  // Crear (registro de la solicitud)
  // =================================================================
  app.post("/solicitudes", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      // Validar que existan ciudadano y trámite
      const [ciudadano, tramite] = await Promise.all([
        prisma.ciudadano.findUnique({ where: { id: body.ciudadanoId } }),
        prisma.tramite.findUnique({ where: { id: body.tramiteId } }),
      ]);
      if (!ciudadano) throw errors.notFound("Ciudadano", body.ciudadanoId);
      if (!tramite) throw errors.notFound("Trámite", body.tramiteId);
      if (!tramite.activo) throw errors.badRequest("Trámite no activo");
      if (!ciudadano.activo) throw errors.badRequest("Ciudadano inactivo");

      const folio = await generarFolioSolicitud();

      // Estado inicial: si requiere pago → PENDIENTE_PAGO, si no → EN_REVISION
      const estadoInicial = tramite.requierePago
        ? EstadoSolicitud.PENDIENTE_PAGO
        : EstadoSolicitud.EN_REVISION;

      // Cálculo de precio.
      // - Si el body trae precioFinal explícito, se respeta (caso típico:
      //   descuento aplicado por el operador al crear la solicitud).
      // - Para PERMISO_PODA sin precioFinal en el body, se calcula desde
      //   datos.altura + vvuma. Si no hay altura válida, queda null.
      // - Para PERMISO_DERRIBO sin precioFinal en el body, se calcula
      //   desde datos.nombreComun + vvuma (5x/30x/4x según especie).
      // - Para SERVICIO_PODA sin precioFinal en el body, se calcula desde
      //   datos.altura + vvuma con los rangos 4/8/12/16.
      // - Para USO_CONTENEDORES sin precioFinal en el body, se calcula
      //   desde datos.tipoGenerador + datos.mesesPermiso + vvuma.
      // - Para el resto, se usa precioBase del catálogo.
      let precioFinal: number | null;
      if (body.precioFinal !== undefined && body.precioFinal !== null) {
        precioFinal = body.precioFinal;
      } else if (tramite.codigo === "PERMISO_PODA") {
        const vvuma = await obtenerVvuma();
        precioFinal = calcularPrecioPoda(
          (body.datos as Record<string, unknown> | null | undefined)?.altura as
            | number
            | string
            | null
            | undefined,
          vvuma,
        );
      } else if (tramite.codigo === "PERMISO_DERRIBO") {
        // Cálculo volumétrico oficial (ver CalculadoraIMBIO.html):
        // requiere especie, perimetro (cm), altura (m) y factorForma.
        const vvuma = await obtenerVvuma();
        precioFinal = calcularPrecioDerribo(
          body.datos as Record<string, unknown> | null | undefined,
          vvuma,
        );
      } else if (tramite.codigo === "SERVICIO_PODA") {
        const vvuma = await obtenerVvuma();
        precioFinal = calcularPrecioServicioPoda(
          (body.datos as Record<string, unknown> | null | undefined)?.altura as
            | number
            | string
            | null
            | undefined,
          vvuma,
        );
      } else if (tramite.codigo === "SERVICIO_DERRIBO") {
        const vvuma = await obtenerVvuma();
        precioFinal = calcularPrecioServicioDerribo(
          (body.datos as Record<string, unknown> | null | undefined)?.altura as
            | number
            | string
            | null
            | undefined,
          vvuma,
        );
      } else if (tramite.codigo === "USO_CONTENEDORES") {
        const vvuma = await obtenerVvuma();
        precioFinal = calcularPrecioUsoContenedores(
          (body.datos as Record<string, unknown> | null | undefined)
            ?.tipoGenerador as string | null | undefined,
          (body.datos as Record<string, unknown> | null | undefined)
            ?.mesesPermiso as number | string | null | undefined,
          vvuma,
        );
      } else {
        precioFinal = tramite.precioBase ? Number(tramite.precioBase) : null;
      }

      const created = await prisma.solicitud.create({
        data: {
          folio,
          ciudadanoId: body.ciudadanoId,
          tramiteId: body.tramiteId,
          datos: body.datos as any,
          estado: estadoInicial,
          precioFinal: precioFinal ?? null,
          fechaAtencion: body.fechaAtencion ? new Date(body.fechaAtencion) : null,
          observaciones: body.observaciones ?? null,
        },
        include: {
          ciudadano: true,
          tramite: true,
        },
      });

      return reply.status(201).send({ ok: true, data: created });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // =================================================================
  // Actualizar datos (antes del pago)
  // =================================================================
  app.patch<{ Params: { id: string } }>(
    "/solicitudes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = updateDatosSchema.parse(request.body);

        const solicitud = await prisma.solicitud.findUnique({
          where: { id },
          include: { tramite: { select: { codigo: true } } },
        });
        if (!solicitud) throw errors.notFound("Solicitud", id);
        const estadosCerrados: EstadoSolicitud[] = [
          EstadoSolicitud.AUTORIZADA,
          EstadoSolicitud.CANCELADA,
        ];
        if (estadosCerrados.includes(solicitud.estado)) {
          throw errors.conflict(
            `No se puede modificar una solicitud en estado ${solicitud.estado}`,
          );
        }

        // Determinar el precioFinal final.
        // - Si el body trae precioFinal explícito, lo respetamos tal cual
        //   (caso típico: descuento manual aplicado por el operador).
        // - Si NO trae y es PERMISO_PODA / SERVICIO_PODA con altura en los
        //   datos resultantes, recalculamos desde altura + vvuma.
        // - Si NO trae y es PERMISO_DERRIBO con nombreComun en los datos
        //   resultantes, recalculamos con la fórmula por especie.
        // - Si NO trae y es USO_CONTENEDORES con tipoGenerador +
        //   mesesPermiso en los datos resultantes, recalculamos con la
        //   fórmula factor × VVUMA × meses.
        // - En cualquier otro caso, dejamos el precio actual (no se toca).
        let precioFinal: number | null | undefined;
        if (body.precioFinal !== undefined) {
          precioFinal = body.precioFinal;
        } else if (
          solicitud.tramite?.codigo === "PERMISO_PODA" ||
          solicitud.tramite?.codigo === "PERMISO_DERRIBO" ||
          solicitud.tramite?.codigo === "SERVICIO_PODA" ||
          solicitud.tramite?.codigo === "SERVICIO_DERRIBO" ||
          solicitud.tramite?.codigo === "USO_CONTENEDORES"
        ) {
          const datosFinales = {
            ...((solicitud.datos as Record<string, unknown> | null) ?? {}),
            ...((body.datos as Record<string, unknown> | undefined) ?? {}),
          };
          const vvuma = await obtenerVvuma();
          if (solicitud.tramite?.codigo === "PERMISO_PODA") {
            precioFinal = calcularPrecioPoda(
              datosFinales.altura as number | string | null | undefined,
              vvuma,
            );
          } else if (solicitud.tramite?.codigo === "PERMISO_DERRIBO") {
            // Cálculo volumétrico oficial (especie + perimetro +
            // altura + factorForma) — ver CalculadoraIMBIO.html.
            precioFinal = calcularPrecioDerribo(datosFinales, vvuma);
          } else if (solicitud.tramite?.codigo === "SERVICIO_PODA") {
            precioFinal = calcularPrecioServicioPoda(
              datosFinales.altura as number | string | null | undefined,
              vvuma,
            );
          } else if (solicitud.tramite?.codigo === "SERVICIO_DERRIBO") {
            precioFinal = calcularPrecioServicioDerribo(
              datosFinales.altura as number | string | null | undefined,
              vvuma,
            );
          } else {
            precioFinal = calcularPrecioUsoContenedores(
              datosFinales.tipoGenerador as string | null | undefined,
              datosFinales.mesesPermiso as number | string | null | undefined,
              vvuma,
            );
          }
        }

        const updated = await prisma.solicitud.update({
          where: { id },
          data: {
            ...(body.datos ? { datos: body.datos as any } : {}),
            ...(precioFinal !== undefined ? { precioFinal } : {}),
            ...(body.fechaAtencion !== undefined
              ? { fechaAtencion: body.fechaAtencion ? new Date(body.fechaAtencion) : null }
              : {}),
            ...(body.observaciones !== undefined
              ? { observaciones: body.observaciones }
              : {}),
          },
        });
        return { ok: true, data: updated };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // =================================================================
  // Cambiar estado (transiciones explícitas)
  // =================================================================
  app.post<{ Params: { id: string } }>(
    "/solicitudes/:id/estado",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const { estado, motivo } = updateEstadoSchema.parse(request.body);

        const solicitud = await prisma.solicitud.findUnique({
          where: { id },
          include: { pago: true, autorizacion: true },
        });
        if (!solicitud) throw errors.notFound("Solicitud", id);

        // Transiciones válidas
        const transiciones: Record<EstadoSolicitud, EstadoSolicitud[]> = {
          [EstadoSolicitud.REGISTRADA]: [
            EstadoSolicitud.PENDIENTE_PAGO,
            EstadoSolicitud.EN_REVISION,
            EstadoSolicitud.RECHAZADA,
            EstadoSolicitud.CANCELADA,
          ],
          [EstadoSolicitud.PENDIENTE_PAGO]: [
            EstadoSolicitud.PAGADA,
            EstadoSolicitud.CANCELADA,
            EstadoSolicitud.RECHAZADA,
          ],
          [EstadoSolicitud.PAGADA]: [
            EstadoSolicitud.EN_REVISION,
            EstadoSolicitud.AUTORIZADA,
            EstadoSolicitud.RECHAZADA,
            EstadoSolicitud.CANCELADA,
          ],
          [EstadoSolicitud.EN_REVISION]: [
            EstadoSolicitud.AUTORIZADA,
            EstadoSolicitud.RECHAZADA,
            EstadoSolicitud.CANCELADA,
          ],
          [EstadoSolicitud.AUTORIZADA]: [],
          [EstadoSolicitud.RECHAZADA]: [],
          [EstadoSolicitud.CANCELADA]: [],
        };

        if (!transiciones[solicitud.estado].includes(estado)) {
          throw errors.conflict(
            `Transición inválida: ${solicitud.estado} → ${estado}`,
          );
        }

        // Reglas de negocio
        if (estado === EstadoSolicitud.AUTORIZADA && !solicitud.autorizacion) {
          throw errors.conflict(
            "Para autorizar, primero debe crearse el documento de autorización",
          );
        }

        if (
          (estado === EstadoSolicitud.RECHAZADA || estado === EstadoSolicitud.CANCELADA) &&
          !motivo
        ) {
          throw errors.badRequest(`Motivo requerido para ${estado}`);
        }

        const updated = await prisma.solicitud.update({
          where: { id },
          data: {
            estado,
            ...(estado === EstadoSolicitud.PAGADA ? { fechaPago: solicitud.pago?.fechaPago ?? new Date() } : {}),
            ...(estado === EstadoSolicitud.AUTORIZADA
              ? { fechaAutorizacion: new Date() }
              : {}),
            ...(motivo ? { observaciones: (solicitud.observaciones ?? "") + (solicitud.observaciones ? "\n" : "") + `[${new Date().toISOString()}] ${estado}: ${motivo}` } : {}),
          },
        });

        return { ok: true, data: updated };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // =================================================================
  // Registrar pago
  // =================================================================
  app.post<{ Params: { id: string } }>(
    "/solicitudes/:id/pago",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = pagoSchema.parse(request.body);

        const solicitud = await prisma.solicitud.findUnique({
          where: { id },
          include: { pago: true },
        });
        if (!solicitud) throw errors.notFound("Solicitud", id);
        if (solicitud.pago) {
          throw errors.conflict("La solicitud ya tiene un pago registrado");
        }
        const estadosPrePago: EstadoSolicitud[] = [
          EstadoSolicitud.REGISTRADA,
          EstadoSolicitud.PENDIENTE_PAGO,
        ];
        if (!estadosPrePago.includes(solicitud.estado)) {
          throw errors.conflict(
            `No se puede registrar pago en estado ${solicitud.estado}`,
          );
        }

        // Crear pago y pasar a PAGADA en una transacción
        const result = await prisma.$transaction(async (tx) => {
          const pago = await tx.pago.create({
            data: {
              solicitudId: id,
              folioPago: body.folioPago,
              tipo: body.tipo,
              monto: body.monto,
              fechaPago: new Date(body.fechaPago),
              lugarPago: body.lugarPago ?? null,
              observaciones: body.observaciones ?? null,
              registradoPorId: body.registradoPorId ?? null,
            },
          });
          const updated = await tx.solicitud.update({
            where: { id },
            data: {
              estado: EstadoSolicitud.PAGADA,
            },
          });
          return { pago, solicitud: updated };
        });

        return reply.status(201).send({ ok: true, data: result });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // =================================================================
  // Crear autorización (cuando ya está pagada y revisada)
  // =================================================================
  app.post<{ Params: { id: string } }>(
    "/solicitudes/:id/autorizacion",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = autorizacionSchema.parse(request.body);

        // Cargamos la solicitud + trámite + ciudadano para poder generar
        // el PDF después si corresponde.
        const solicitud = await prisma.solicitud.findUnique({
          where: { id },
          include: {
            pago: true,
            autorizacion: true,
            tramite: true,
            ciudadano: true,
          },
        });
        if (!solicitud) throw errors.notFound("Solicitud", id);
        if (solicitud.autorizacion) {
          throw errors.conflict("La solicitud ya tiene una autorización");
        }

        const numeroAutorizacion = await generarNumeroAutorizacion();
        const fechaEmision = new Date();

        // ============================================================
        // Auto-cálculo de fechaVencimiento para USO_CONTENEDORES.
        //
        // Para el resto de los trámites, la fecha de vencimiento es
        // opcional y la define el operador (o queda null). Pero para
        // Uso de Contenedores, la vigencia se calcula automáticamente
        // como `fechaEmision + mesesPermiso`, leyendo los meses desde
        // la solicitud.
        //
        // Si el body trae `fechaVencimiento` explícita, respetamos esa
        // (caso edge: override manual del operador).
        // ============================================================
        let fechaVencimiento: Date | null = body.fechaVencimiento
          ? new Date(body.fechaVencimiento)
          : null;
        if (solicitud.tramite.codigo === "USO_CONTENEDORES") {
          const datos = (solicitud.datos ?? {}) as Record<string, unknown>;
          const meses = datos.mesesPermiso as number | string | null | undefined;
          const calculada = calcularVencimientoContenedor(fechaEmision, meses);
          if (calculada) {
            // Si el operador no mandó fecha, usamos la auto-calculada.
            // Si mandó, respetamos su valor.
            fechaVencimiento = fechaVencimiento ?? calculada;
          }
        }

        // 1) Crear la autorización y cambiar el estado en una transacción
        const result = await prisma.$transaction(async (tx) => {
          const aut = await tx.autorizacion.create({
            data: {
              solicitudId: id,
              numeroAutorizacion,
              fechaEmision,
              fechaVencimiento,
              emitidoPorId: body.emitidoPorId ?? null,
              considerandos: body.considerandos ?? null,
              observaciones: body.observaciones ?? null,
            },
            include: { emitidoPor: true },
          });
          const updated = await tx.solicitud.update({
            where: { id },
            data: {
              estado: EstadoSolicitud.AUTORIZADA,
            },
          });
          return { autorizacion: aut, solicitud: updated };
        });

        // 2) Si el trámite genera PDF, lo creamos y lo guardamos en BD.
        //    Lo hacemos fuera de la transacción porque pdfkit no necesita
        //    una conexión a la BD mientras escribe. Si falla, no afecta la
        //    autorización ya creada (sólo quedará sin PDF).
        let pdfGenerado = false;
        if (debeGenerarPdf(solicitud.tramite.codigo)) {
          try {
            const pdfBuffer = await generarPdfAutorizacion(
              solicitud.tramite.codigo,
              {
                tramite: solicitud.tramite as any,
                solicitud: {
                  id: solicitud.id,
                  folio: solicitud.folio,
                  datos:
                    (solicitud.datos as Record<string, unknown> | null) ?? {},
                },
                autorizacion: {
                  ...result.autorizacion,
                  emitidoPor: result.autorizacion.emitidoPor
                    ? {
                        id: result.autorizacion.emitidoPor.id,
                        nombre: result.autorizacion.emitidoPor.nombre,
                        cargo: result.autorizacion.emitidoPor.cargo,
                      }
                    : null,
                },
                ciudadano: solicitud.ciudadano,
              },
            );
            await prisma.autorizacion.update({
              where: { id: result.autorizacion.id },
              data: { documentoPdf: pdfBuffer },
            });
            pdfGenerado = true;
          } catch (pdfErr) {
            // Logueamos pero no rompemos la autorización
            request.log.error(
              { err: pdfErr, autorizacionId: result.autorizacion.id },
              "Error al generar PDF de autorización",
            );
          }
        }

        return reply.status(201).send({
          ok: true,
          data: { ...result, pdfGenerado },
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // =================================================================
  // Eliminar (hard-delete en cualquier estado)
  // =================================================================
  // Borra la solicitud de la base de datos. Si tiene Pago o Autorizacion
  // asociados, el cascade del schema los borra automáticamente.
  app.delete<{ Params: { id: string } }>(
    "/solicitudes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const solicitud = await prisma.solicitud.findUnique({
          where: { id },
          include: { pago: true, autorizacion: true },
        });
        if (!solicitud) throw errors.notFound("Solicitud", id);

        // Borrado transaccional: primero Pago y Autorizacion (si existen),
        // después Solicitud. Lo hacemos explícito para no depender sólo
        // del cascade del schema y devolver un resumen más informativo.
        const result = await prisma.$transaction(async (tx) => {
          let pagoBorrado = false;
          let autorizacionBorrada = false;
          if (solicitud.pago) {
            await tx.pago.delete({ where: { id: solicitud.pago.id } });
            pagoBorrado = true;
          }
          if (solicitud.autorizacion) {
            await tx.autorizacion.delete({
              where: { id: solicitud.autorizacion.id },
            });
            autorizacionBorrada = true;
          }
          await tx.solicitud.delete({ where: { id } });
          return { pagoBorrado, autorizacionBorrada };
        });

        return {
          ok: true,
          data: {
            id,
            deleted: true,
            pagoBorrado: result.pagoBorrado,
            autorizacionBorrada: result.autorizacionBorrada,
            estadoAnterior: solicitud.estado,
          },
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // =================================================================
  // Marcas y modelos únicos ya registrados (para autocompletado)
  // =================================================================
  // Devuelve los valores únicos de Solicitud.datos.marca y .modelo
  // que ya están guardados, más una lista base hardcodeada de
  // marcas/modelos comunes de México como fallback. La lista
  // combinada se ordena por frecuencia y se devuelve.
  //
  // Implementación: como `datos` es un JSON column de Prisma, no
  // podemos hacer un DISTINCT directo. Hacemos dos queries que
  // traen los últimos N registros con marca/modelo no vacíos, y
  // deduplicamos en memoria. Escala bien hasta varios miles de
  // registros; si crece mucho se puede pasar a un índice GIN o
  // extraer a columnas dedicadas.

  /** Marcas comunes de pickups/camionetas en México. */
  const MARCAS_BASE: readonly string[] = [
    "Toyota",
    "Nissan",
    "Chevrolet",
    "Ford",
    "RAM",
    "GMC",
    "Jeep",
    "Volkswagen",
    "Mazda",
    "Honda",
    "Mitsubishi",
    "Isuzu",
    "Dodge",
    "Fiat",
    "Renault",
    "Kia",
    "Hyundai",
    "Suzuki",
  ];

  /** Modelos comunes de pickups (se muestran siempre). */
  const MODELOS_BASE: readonly string[] = [
    // Toyota
    "Hilux",
    "Tacoma",
    "Tundra",
    // Nissan
    "Frontier",
    "NP300",
    "Titan",
    // Ford
    "Ranger",
    "F-150",
    "F-250",
    "F-350",
    "Super Duty",
    "Explorer",
    "Expedition",
    // Chevrolet
    "Silverado",
    "Colorado",
    "S-10",
    "Cheyenne",
    "Avalanche",
    "Tahoe",
    "Suburban",
    // RAM / Dodge
    "1500",
    "2500",
    "3500",
    "Ram 1500",
    "Ram 2500",
    "Durango",
    // GMC
    "Sierra",
    "Yukon",
    "Canyon",
    // Jeep
    "Wrangler",
    "Gladiator",
    "Grand Cherokee",
    "Cherokee",
    // Volkswagen
    "Amarok",
    "Saveiro",
    // Mazda
    "BT-50",
    // Mitsubishi
    "L200",
    "Montero",
    // Isuzu
    "D-Max",
    "Rodeo",
  ];

  app.get("/solicitudes/marcas-modelos", async (_request, reply) => {
    try {
      const ULTIMAS = 500;

      const [marcasRows, modelosRows] = await Promise.all([
        prisma.solicitud.findMany({
          where: {
            tramite: { codigo: "PERMISO_TRASLADO_LENA" },
          },
          orderBy: { id: "desc" },
          take: ULTIMAS,
          select: { datos: true },
        }),
        prisma.solicitud.findMany({
          where: {
            tramite: { codigo: "PERMISO_TRASLADO_LENA" },
          },
          orderBy: { id: "desc" },
          take: ULTIMAS,
          select: { datos: true },
        }),
      ]);

      const uniq = (vals: string[]): string[] => {
        const counts = new Map<string, number>();
        for (const v of vals) {
          const key = v.trim();
          if (!key) continue;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k]) => k);
      };

      const extract = (rows: { datos: unknown }[], key: string): string[] =>
        rows
          .map((r) => {
            const d = (r.datos as Record<string, unknown> | null) ?? {};
            const v = d[key];
            return typeof v === "string" ? v.trim() : "";
          })
          .filter((v) => v.length > 0);

      // Combina DB + fallback. La lista de la DB va primero
      // (ordenada por frecuencia real), seguida del fallback
      // (sin duplicados).
      const marcasDb = uniq(extract(marcasRows, "marca"));
      const modelosDb = uniq(extract(modelosRows, "modelo"));
      const marcasSet = new Set(marcasDb);
      const modelosSet = new Set(modelosDb);
      const marcas = [
        ...marcasDb,
        ...MARCAS_BASE.filter((m) => !marcasSet.has(m)),
      ];
      const modelos = [
        ...modelosDb,
        ...MODELOS_BASE.filter((m) => !modelosSet.has(m)),
      ];

      return {
        ok: true,
        data: {
          marcas,
          modelos,
        },
      };
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
