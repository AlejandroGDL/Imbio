/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Modo de operación al compilar: "server" (default) o "client". */
  readonly VITE_IMBIO_MODE?: "server" | "client";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
