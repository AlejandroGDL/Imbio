/**
 * Resalta las ocurrencias de `query` dentro de `text` con un <mark>.
 * Si `query` está vacío, devuelve el texto plano.
 *
 * - Case-insensitive
 * - Escapa caracteres regex de la query
 * - Soporta múltiples matches
 */

import { Fragment } from "react";

interface HighlightProps {
  text: string;
  query: string;
  className?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function Highlight({ text, query, className }: HighlightProps) {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const regex = new RegExp(`(${escapeRegex(query.trim())})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className={className ?? "rounded bg-amber-200 px-0.5 text-amber-900"}
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
