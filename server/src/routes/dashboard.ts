/**
 * Endpoint de Dashboard.
 *
 * GET /dashboard — devuelve un solo payload con todo lo que la página
 * de inicio necesita:
 *   - stats: contadores rápidos por módulo
 *   - cumpleanosProximos: personal con cumpleaños en los próximos 30 días
 *   - correspondenciaPendiente: docs que ocupan respuesta y están
 *     próximos a vencer o ya vencidos
 *
 * Todo se calcula en una sola llamada para que la página cargue rápido
 * y no haya que orquestar múltiples requests en el cliente.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { handleError } from "../lib/errors";

/** Convierte un Date a "YYYY-MM-DD" o null */
function toYmd(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (_request, reply) => {
    try {
      // Una sola Promise.all con todas las queries (paralelas)
      const [
        totalCiudadanos,
        totalPersonal,
        totalTramites,
        solicitudesPorEstado,
        solicitudesActivas,
        reqPendientes,
        reqSurtidas,
        totalConsumibles,
        consumiblesSinStock,
        todosConsumibles,
        totalResguardos,
        resguardosAsignados,
        resguardosEnBodega,
        resguardosBaja,
        correspondenciaPendiente,
        personalConCumple,
        areasVerdesProximas,
        eventosCorrespondenciaRaw,
      ] = await Promise.all([
        prisma.ciudadano.count({ where: { activo: true } }),
        prisma.personal.count({ where: { activo: true } }),
        prisma.tramite.count({ where: { activo: true } }),
        prisma.solicitud.groupBy({ by: ["estado"], _count: true }),
        // Solicitudes activas = no terminadas (excluye AUTORIZADA, RECHAZADA, CANCELADA)
        prisma.solicitud.count({
          where: {
            estado: {
              in: ["REGISTRADA", "PENDIENTE_PAGO", "PAGADA", "EN_REVISION"],
            },
          },
        }),
        prisma.requisicion.count({
          where: { activo: true, surtido: false },
        }),
        prisma.requisicion.count({
          where: { activo: true, surtido: true },
        }),
        prisma.consumible.count({ where: { activo: true } }),
        prisma.consumible.count({
          where: { activo: true, cantidadActual: { lte: 0 } },
        }),
        prisma.consumible.findMany({
          where: { activo: true },
          select: { cantidadActual: true },
        }),
        prisma.resguardo.count({ where: { activo: true } }),
        prisma.resguardo.count({
          where: { activo: true, estado: "ASIGNADO" },
        }),
        prisma.resguardo.count({
          where: { activo: true, estado: "EN_BODEGA" },
        }),
        prisma.resguardo.count({
          where: { activo: true, estado: "BAJA" },
        }),
        prisma.correspondencia.findMany({
          where: {
            activo: true,
            ocupaRespuesta: true,
            status: "PENDIENTE",
            fechaMaximaRespuesta: { not: null },
          },
          orderBy: { fechaMaximaRespuesta: "asc" },
          take: 20,
        }),
        prisma.personal.findMany({
          where: { activo: true, fechaNacimiento: { not: null } },
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            puesto: true,
            fechaNacimiento: true,
          },
        }),
        // Áreas verdes próximas: desde hoy hasta +30 días, ordenadas por fecha
        prisma.areaVerde.findMany({
          where: {
            activo: true,
            fecha: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { fecha: "asc" },
          take: 10,
        }),
        // Correspondencia con eventos próximos (asisteAEvento + fechasEvento)
        prisma.correspondencia.findMany({
          where: {
            activo: true,
            asisteAEvento: true,
            fechasEvento: { isEmpty: false },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
        }),
      ]);

      // ===========================================================
      // Stock bajo: > 0 pero < 5
      // ===========================================================
      let consumiblesStockBajo = 0;
      for (const c of todosConsumibles) {
        const n = Number(c.cantidadActual);
        if (n > 0 && n < 5) consumiblesStockBajo++;
      }

      // ===========================================================
      // Solicitudes agrupadas por estado
      // ===========================================================
      const solicitudes: Record<string, number> = {
        total: solicitudesPorEstado.reduce((acc, s) => acc + s._count, 0),
      };
      for (const s of solicitudesPorEstado) {
        solicitudes[s.estado] = s._count;
      }

      // ===========================================================
      // Cumpleaños próximos (próximos 30 días)
      // ===========================================================
      const hoy = new Date();
      const cumpleanos: Array<{
        id: number;
        nombre: string;
        apellidos: string;
        puesto: string;
        fechaNacimiento: string;
        proximo: string;
        diasRestantes: number;
      }> = [];

      for (const p of personalConCumple) {
        if (!p.fechaNacimiento) continue;
        const fn = new Date(p.fechaNacimiento);
        // Próximo cumpleaños: este año si no ha pasado, si no el año que viene
        const cumpleEsteAnio = new Date(
          hoy.getFullYear(),
          fn.getMonth(),
          fn.getDate(),
        );
        const cumpleProxAnio = new Date(
          hoy.getFullYear() + 1,
          fn.getMonth(),
          fn.getDate(),
        );
        const proximo =
          cumpleEsteAnio >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
            ? cumpleEsteAnio
            : cumpleProxAnio;
        const diasRestantes = Math.ceil(
          (proximo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diasRestantes <= 30) {
          cumpleanos.push({
            id: p.id,
            nombre: p.nombre,
            apellidos: p.apellidos,
            puesto: p.puesto,
            fechaNacimiento: toYmd(p.fechaNacimiento) ?? "",
            proximo: toYmd(proximo) ?? "",
            diasRestantes,
          });
        }
      }
      cumpleanos.sort((a, b) => a.diasRestantes - b.diasRestantes);

      // ===========================================================
      // Correspondencia con días restantes
      // ===========================================================
      const correspondencia: Array<{
        id: number;
        numero: string;
        asunto: string;
        fechaMaximaRespuesta: string | null;
        diasRestantes: number | null;
        status: string;
        tipo: string;
        remitente: string;
      }> = [];

      for (const c of correspondenciaPendiente) {
        const fmr = c.fechaMaximaRespuesta
          ? new Date(c.fechaMaximaRespuesta)
          : null;
        const dias = fmr
          ? Math.ceil(
              (fmr.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
            )
          : null;
        correspondencia.push({
          id: c.id,
          numero: c.numero,
          asunto: c.asunto,
          fechaMaximaRespuesta: toYmd(c.fechaMaximaRespuesta),
          diasRestantes: dias,
          status: c.status,
          tipo: c.tipo,
          remitente: c.remitente,
        });
      }

      // ===========================================================
      // Áreas verdes próximas
      // ===========================================================
      const areasVerdesFormateadas = areasVerdesProximas.map((a) => {
        const dias = Math.ceil(
          (new Date(a.fecha).getTime() - hoy.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return {
          id: a.id,
          areaVerde: a.areaVerde,
          usuario: a.usuario,
          tipoEvento: a.tipoEvento,
          fecha: toYmd(a.fecha) ?? "",
          horaInicio: a.horaInicio,
          horaFin: a.horaFin,
          responsable: a.responsable,
          diasRestantes: dias,
        };
      });

      // ===========================================================
      // Correspondencia con eventos próximos (asisteAEvento)
      // ===========================================================
      // Lookup de los asistentes (una sola query batch)
      const allAsistentesIds = Array.from(
        new Set(eventosCorrespondenciaRaw.flatMap((c) => c.asistentesIds ?? [])),
      );
      const asistentesInfo =
        allAsistentesIds.length > 0
          ? await prisma.personal.findMany({
              where: { id: { in: allAsistentesIds } },
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                puesto: true,
              },
            })
          : [];
      const asistenteMap = new Map(asistentesInfo.map((p) => [p.id, p]));

      const eventosCorrespondencia = eventosCorrespondenciaRaw
        .map((c) => {
          // Tomamos el evento más próximo para calcular diasRestantes
          const fechasOrdenadas = (c.fechasEvento ?? [])
            .map((f) => new Date(f))
            .filter((f) => f.getTime() >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime())
            .sort((a, b) => a.getTime() - b.getTime());
          const proximo = fechasOrdenadas[0] ?? null;
          const diasRestantes = proximo
            ? Math.ceil(
                (proximo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
              )
            : null;
          return {
            id: c.id,
            numero: c.numero,
            asunto: c.asunto,
            tipo: c.tipo,
            status: c.status,
            fechasEvento: c.fechasEvento.map((f) => f.toISOString().slice(0, 10)),
            asistentesIds: c.asistentesIds ?? [],
            asistentes: (c.asistentesIds ?? [])
              .map((id) => asistenteMap.get(id))
              .filter((p): p is NonNullable<typeof p> => p !== undefined),
            diasRestantes,
          };
        })
        // Solo los que tengan al menos un evento en el futuro
        .filter((c) => c.diasRestantes !== null)
        .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0))
        .slice(0, 10);

      // Cumpleaños de este mes (para stat extra)
      const cumpleEsteMes = cumpleanos.filter((c) => {
        const [, m] = c.proximo.split("-");
        return m === String(hoy.getMonth() + 1).padStart(2, "0");
      }).length;

      return {
        ok: true,
        data: {
          stats: {
            ciudadanos: totalCiudadanos,
            personal: totalPersonal,
            tramites: totalTramites,
            solicitudes,
            solicitudesActivas,
            cumpleanosEsteMes: cumpleEsteMes,
            requisiciones: {
              pendientes: reqPendientes,
              surtidas: reqSurtidas,
              total: reqPendientes + reqSurtidas,
            },
            consumibles: {
              total: totalConsumibles,
              sinStock: consumiblesSinStock,
              stockBajo: consumiblesStockBajo,
            },
            resguardos: {
              total: totalResguardos,
              asignados: resguardosAsignados,
              enBodega: resguardosEnBodega,
              baja: resguardosBaja,
            },
            areasVerdes: {
              proximos30Dias: areasVerdesFormateadas.length,
            },
          },
          cumpleanosProximos: cumpleanos,
          correspondenciaPendiente: correspondencia,
          areasVerdesProximas: areasVerdesFormateadas,
          eventosCorrespondencia,
        },
      };
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
