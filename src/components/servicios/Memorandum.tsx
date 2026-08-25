import { useEffect, useState } from "react";
import { Printer, Loader2, AlertCircle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";

import { api, ApiError } from "@/lib/api";
import { getServerUrl } from "@/lib/config";
import { numeroALetras } from "@/lib/numero-a-letras";
import { generarCadenaSeguridad } from "@/lib/hash";
import type { Solicitud, Tramite } from "@/types/api";

interface MemorandumProps {
  solicitudId: number;
  folio: string;
  onClose?: () => void;
}

function formatFechaHoraCorta(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function derivarSufijoMemo(nombre: string): string | null {
  const STOPWORDS = new Set([
    "de", "del", "la", "el", "los", "las", "y", "en", "a", "para",
    "con", "sin", "por", "un", "una",
  ]);
  const limpio = nombre
    .replace(/\([^)]*\)/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .trim();
  const palabras = limpio.split(/\s+/).filter((p) => p && !STOPWORDS.has(p.toLowerCase()));
  if (palabras.length === 0) return null;
  const primera = palabras[0];
  if (primera.length <= 4 && palabras.length > 1) {
    return (primera + " " + palabras[1]).toUpperCase();
  }
  return primera.toUpperCase();
}

// =================================================================
// Estilos compartidos (vista previa + PDF)
// Aplican los mismos estilos al preview del Dialog y al PDF standalone.
// =================================================================
const MEMO_STYLES = `
  .memo {
    width: 8.5in;
    max-width: 100%;
    min-height: 9.5in;
    margin: 0 auto;
    padding: 0.5in 0.8in;
    background: white;
    color: black;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .memo *, .memo *::before, .memo *::after { box-sizing: border-box; }
  .memo-header {
    text-align: center;
    border-bottom: 2px solid #047857;
    padding-bottom: 8px;
  }
  .memo-header .logo-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 6px;
  }
  .memo-header img.logo {
    max-height: 72px;
    max-width: 260px;
    object-fit: contain;
  }
  .memo-header p {
    margin: 0;
    font-size: 12px;
    font-weight: normal;
  }
  .memo-header .institucion {
    font-size: 13px;
    font-weight: bold;
    color: #047857;
    margin-top: 2px;
  }
  .memo-title {
    margin: 24px 0 0 0;
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .memo-datos { margin-top: 22px; }
  .memo-datos .row {
    margin: 2px 0;
    display: table;
    width: 100%;
    table-layout: fixed;
  }
  .memo-datos .label {
    display: table-cell;
    width: 240px;
    padding-right: 8px;
    vertical-align: top;
  }
  .memo-datos .valor {
    display: table-cell;
    font-weight: bold;
    vertical-align: top;
  }
  .memo-legal {
    margin-top: 28px;
    text-align: justify;
    font-size: 12px;
  }
  .memo-spacer { flex: 1; }
  .memo-atentamente {
    text-align: center;
    font-weight: bold;
    margin-top: 8px;
  }
  /* Firmas apiladas: Director arriba, Técnico abajo */
  .memo-firmas {
    margin-top: 32px;
    text-align: center;
  }
  .memo-firmas .bloque {
    margin-bottom: 24px;
  }
  .memo-firmas .bloque:last-child { margin-bottom: 0; }
  .memo-firmas .bloque p { margin: 2px 0; }
  .memo-firmas .bloque .nombre { font-weight: bold; }
  .memo-firmas .firma-img {
    max-height: 56px;
    max-width: 200px;
    object-fit: contain;
    margin: 0 auto 4px;
    display: block;
  }
  .memo-cadena {
    text-align: center;
    font-size: 10px;
    color: #404040;
    margin-top: 24px;
  }
  .memo-cadena .hash {
    font-family: 'Courier New', monospace;
  }
  @media print {
    @page {
      size: letter;
      margin: 0;
    }
    body { margin: 0; padding: 0; background: white; }
    .memo {
      width: 8.5in;
      min-height: 11in;
      padding: 0.5in 0.8in;
      box-shadow: none;
      max-width: none;
    }
    .memo-header img.logo,
    .memo-firmas .firma-img {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`;

// =================================================================
// Componente
// =================================================================
export function Memorandum({ solicitudId, folio, onClose }: MemorandumProps) {
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [cadenaSeguridad, setCadenaSeguridad] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const s = await api.obtenerSolicitud(solicitudId);
        if (!s) throw new Error("La respuesta del servidor está vacía");
        setSolicitud(s);
        if (!s.tramiteId) throw new Error(`La solicitud no tiene tramiteId (folio=${s.folio})`);
        const t = await api.obtenerTramite(s.tramiteId);
        if (!t) throw new Error("No se pudo cargar el trámite");
        setTramite(t);
        const cadena = await generarCadenaSeguridad(s.folio);
        setCadenaSeguridad(cadena);
      } catch (err) {
        // Loguea el error completo en consola para diagnóstico
        // (visible en F12 → Console)
        // eslint-disable-next-line no-console
        console.error(
          "[Memorandum] Error cargando solicitud",
          "solicitudId:", solicitudId,
          "folio:", folio,
          "err.message:", err instanceof Error ? err.message : String(err),
          "err.stack:", err instanceof Error ? err.stack : "(no stack)",
        );
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? `${err.name}: ${err.message}`
              : "No se pudo cargar la solicitud",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [solicitudId, folio]);

  const handlePrint = () => {
    if (!solicitud || !tramite) {
      alert("Esperá a que carguen los datos del memorándum");
      return;
    }

    const tramiteData = tramite;
    const ciudadano = solicitud.ciudadano;
    const fechaExpedicion = new Date();
    const precio = solicitud.precioFinal ? Number(solicitud.precioFinal) : 0;
    const sufijo = derivarSufijoMemo(tramiteData.nombre);
    const titulo = sufijo
      ? `MEMORÁNDUM DE PAGO - ${sufijo}`
      : "MEMORÁNDUM DE PAGO";
    // Técnico operativo: tomar de los datos de la solicitud.
    // Si no hay, fallback a un valor genérico.
    const tecnicoOperativo =
      (solicitud.datos as any)?.nombreTecnicoAutoriza?.toString().trim() ||
      "Sistema IMBIO";

    const nombreCompleto = ciudadano
      ? `${ciudadano.nombre ?? ""} ${ciudadano.apellidoPaterno ?? ""} ${ciudadano.apellidoMaterno ?? ""}`.trim()
      : "—";
    const importeFmt = precio.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const importeEnLetra = numeroALetras(precio);

    // URLs absolutas a los assets institucionales (logos, firmas).
    // Se sirven vía GET /assets/* del backend.
    const serverUrl = getServerUrl();
    const logoUrl = `${serverUrl}/assets/logo_ayuntamiento.png`;
    const firmaUrl = `${serverUrl}/assets/firma_director_imbio.png`;

    // HTML standalone: generado desde cero (no clona el DOM de la app)
    // Esto evita problemas con clases de Tailwind que no existen en la
    // ventana nueva del PDF.
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Memorándum ${folio}</title>
  <style>${MEMO_STYLES}</style>
</head>
<body>
  <div class="memo">
    <header class="memo-header">
      <div class="logo-wrap">
        <img class="logo" src="${logoUrl}" alt="Logo H. Ayuntamiento de Pabellón de Arteaga" />
      </div>
      <p class="institucion">H. Ayuntamiento de Pabellón de Arteaga 2024-2027</p>
      <p>Instituto Municipal de Biodiversidad y Protección Ambiental</p>
    </header>

    <h1 class="memo-title">${titulo}</h1>

    <div class="memo-datos">
      <div class="row">
        <span class="label">Fecha y hora de expedición:</span>
        <span class="valor">${formatFechaHoraCorta(fechaExpedicion.toISOString())}</span>
      </div>
      <div class="row">
        <span class="label">Folio:</span>
        <span class="valor">${solicitud.folio}</span>
      </div>
      <div class="row">
        <span class="label">Nombre del ciudadano:</span>
        <span class="valor">${escapeHtml(nombreCompleto)}</span>
      </div>
      <div class="row">
        <span class="label">Concepto (trámite oficial):</span>
        <span class="valor">${escapeHtml(tramiteData.nombre)}</span>
      </div>
      <div class="row">
        <span class="label">Importe:</span>
        <span class="valor">$ ${importeFmt}</span>
      </div>
      <div class="row">
        <span class="label">Cantidad en letra:</span>
        <span class="valor">${escapeHtml(importeEnLetra)}</span>
      </div>
    </div>

    <p class="memo-legal">
      Este documento constituye una orden de pago. El ingreso deberá realizarse
      únicamente en las cajas de la Tesorería Municipal. El documento tendrá una
      vigencia de 5 días hábiles a partir de su emisión. En caso de que expire,
      deberá solicitarse la generación de uno nuevo.
    </p>

    <div class="memo-spacer"></div>

    <div class="memo-atentamente">ATENTAMENTE</div>

    <div class="memo-firmas">
      <div class="bloque">
        <img class="firma-img" src="${firmaUrl}" alt="Firma del Director" />
        <p class="nombre">BIÓL. LUIS FELIPE LOZANO ROMÁN</p>
        <p>Director del IMBIO</p>
      </div>
      <div class="bloque">
        <p>Técnico Operativo que emitió el Memorándum:</p>
        <p class="nombre">${escapeHtml(tecnicoOperativo)}</p>
      </div>
    </div>

    <p class="memo-cadena">
      <strong>Código QR de validación</strong> — Cadena de seguridad:
      <span class="hash">${cadenaSeguridad}</span>
    </p>
  </div>

  <script>
    window.addEventListener('load', function() {
      // Esperá a que carguen las imágenes antes de imprimir
      var imgs = document.images;
      var loaded = 0;
      function onReady() {
        setTimeout(function() { window.print(); }, 300);
      }
      if (imgs.length === 0) { onReady(); return; }
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].complete) { loaded++; continue; }
        imgs[i].addEventListener('load', function() {
          loaded++;
          if (loaded >= imgs.length) onReady();
        });
        imgs[i].addEventListener('error', function() {
          loaded++;
          if (loaded >= imgs.length) onReady();
        });
      }
      if (loaded >= imgs.length) onReady();
    });
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(
        "El navegador bloqueó la ventana emergente. Permití ventanas emergentes para este sitio e intentá de nuevo.",
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando memorándum...
      </div>
    );
  }

  if (error || !solicitud) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" />
          Error
        </div>
        {error || "No se encontró la solicitud"}
      </div>
    );
  }

  // Renderizado para la vista previa (mismo layout que el PDF)
  const tramiteData = tramite!;
  const ciudadano = solicitud.ciudadano;
  const fechaExpedicion = new Date();
  const precio = solicitud.precioFinal ? Number(solicitud.precioFinal) : 0;
  const sufijo = derivarSufijoMemo(tramiteData.nombre);
  const titulo = sufijo ? `MEMORÁNDUM DE PAGO - ${sufijo}` : "MEMORÁNDUM DE PAGO";
  const tecnicoOperativo =
    (solicitud.datos as any)?.nombreTecnicoAutoriza?.toString().trim() ||
    "Sistema IMBIO";
  const nombreCompleto = ciudadano
    ? `${ciudadano.nombre ?? ""} ${ciudadano.apellidoPaterno ?? ""} ${ciudadano.apellidoMaterno ?? ""}`.trim()
    : "—";
  const importeFmt = precio.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const importeEnLetra = numeroALetras(precio);

  return (
    <>
      <style>{MEMO_STYLES}</style>

      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-end gap-2">
          <Button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800">
            <Printer className="h-4 w-4" />
            Imprimir / Guardar PDF
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Tip:</strong> en el diálogo de impresión, destildá{" "}
            <em>"Encabezados y pies de página"</em> para que no aparezcan textos
            en las esquinas del PDF.
          </span>
        </div>
      </div>

      {/* Vista previa del memorandum */}
      <div
        id="memorandum"
        className="memo"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <header className="memo-header">
          <div className="logo-wrap">
            {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
            <img
              className="logo"
              src={`${getServerUrl()}/assets/logo_ayuntamiento.png`}
              alt="Logo H. Ayuntamiento de Pabellón de Arteaga"
            />
          </div>
          <p className="institucion">H. Ayuntamiento de Pabellón de Arteaga 2024-2027</p>
          <p>Instituto Municipal de Biodiversidad y Protección Ambiental</p>
        </header>

        <h1 className="memo-title">{titulo}</h1>

        <div className="memo-datos">
          <div className="row">
            <span className="label">Fecha y hora de expedición:</span>
            <span className="valor">{formatFechaHoraCorta(fechaExpedicion.toISOString())}</span>
          </div>
          <div className="row">
            <span className="label">Folio:</span>
            <span className="valor">{solicitud.folio}</span>
          </div>
          <div className="row">
            <span className="label">Nombre del ciudadano:</span>
            <span className="valor">{nombreCompleto}</span>
          </div>
          <div className="row">
            <span className="label">Concepto (trámite oficial):</span>
            <span className="valor">{tramiteData.nombre}</span>
          </div>
          <div className="row">
            <span className="label">Importe:</span>
            <span className="valor">$ {importeFmt}</span>
          </div>
          <div className="row">
            <span className="label">Cantidad en letra:</span>
            <span className="valor">{importeEnLetra}</span>
          </div>
        </div>

        <p className="memo-legal">
          Este documento constituye una orden de pago. El ingreso deberá realizarse
          únicamente en las cajas de la Tesorería Municipal. El documento tendrá una
          vigencia de 5 días hábiles a partir de su emisión. En caso de que expire,
          deberá solicitarse la generación de uno nuevo.
        </p>

        <div className="memo-spacer" />

        <div className="memo-atentamente">ATENTAMENTE</div>

        <div className="memo-firmas">
          <div className="bloque">
            {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
            <img
              className="firma-img"
              src={`${getServerUrl()}/assets/firma_director_imbio.png`}
              alt="Firma del Director"
            />
            <p className="nombre">BIÓL. LUIS FELIPE LOZANO ROMÁN</p>
            <p>Director del IMBIO</p>
          </div>
          <div className="bloque">
            <p>Técnico Operativo que emitió el Memorándum:</p>
            <p className="nombre">{tecnicoOperativo}</p>
          </div>
        </div>

        <p className="memo-cadena">
          <strong>Código QR de validación</strong> — Cadena de seguridad:{" "}
          <span className="hash">{cadenaSeguridad}</span>
        </p>
      </div>
    </>
  );
}

// Escape de HTML para evitar inyecciones en el PDF
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
