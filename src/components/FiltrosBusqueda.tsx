"use client";

import Form from "next/form";
import { useState } from "react";
import { CAMPO } from "@/lib/ui";

export interface VenueOpcion {
  id: string;
  name: string;
  /** Eventos que caen en el venue CON los filtros actuales aplicados. */
  total: number;
}

/**
 * Buscador + selector de lugar. Es un `next/form` con `action` string, así que
 * los campos se serializan a la query y la navegación es del lado del cliente,
 * pero sigue funcionando sin JS (submit nativo). Por eso el `<select>` se
 * envía con `requestSubmit()` y no con un `router.push` a mano: sin JS el botón
 * "Buscar" hace el mismo trabajo.
 *
 * `categoria`, `fecha` y `mes` viajan como hidden para no perder los chips de
 * arriba; el resto de la página los sigue leyendo de la URL igual que antes.
 */
export default function FiltrosBusqueda({
  venues,
  q,
  venue,
  categoria,
  fecha,
  mes,
}: {
  venues: VenueOpcion[];
  q?: string;
  venue?: string;
  categoria?: string;
  fecha?: string;
  mes?: string;
}) {
  // Campos controlados y sincronizados con la URL durante el render (el patrón
  // de React para "ajustar estado cuando cambia una prop", sin efecto).
  // Hacen falta porque la navegación entre filtros es blanda: el componente NO
  // se remonta, así que con campos no controlados un "Quitar búsqueda" dejaba
  // el texto viejo en la caja y el submit siguiente lo volvía a mandar.
  // Ojo: forzar el remonte con `key` NO sirve — deja los inputs anteriores
  // colgados en el DOM y la query sale con el parámetro repetido.
  const [texto, setTexto] = useState(q ?? "");
  const [lugar, setLugar] = useState(venue ?? "");
  const [urlPrevia, setUrlPrevia] = useState<[string, string]>([q ?? "", venue ?? ""]);
  if (urlPrevia[0] !== (q ?? "") || urlPrevia[1] !== (venue ?? "")) {
    setUrlPrevia([q ?? "", venue ?? ""]);
    setTexto(q ?? "");
    setLugar(venue ?? "");
  }

  return (
    <Form
      action="/"
      // Un form serializa TODOS sus campos, así que buscar sin lugar dejaba
      // `?q=lo+que+sea&venue=` en la barra y en cualquier URL compartida. Un
      // campo deshabilitado no se serializa: se apagan los vacíos justo antes
      // de que el submit los lea y se reactivan en el siguiente tick, ya con la
      // query armada. No se usa `preventDefault` a propósito — según los docs
      // de `next/form` eso anularía la navegación del lado del cliente.
      onSubmit={(e) => {
        const campos = [...e.currentTarget.elements].filter(
          (el): el is HTMLInputElement | HTMLSelectElement =>
            el instanceof HTMLInputElement || el instanceof HTMLSelectElement,
        );
        const fuera = campos.filter((el) => el.value === "");
        // Buscar SALE de la página de mes: los shows grandes se anuncian con
        // casi un año y son los que se buscan por nombre, así que una búsqueda
        // barre todo el futuro. Cambiar de LUGAR no: ése sí es un ajuste
        // dentro del mes que se está viendo, y por eso `mes` viaja de hidden.
        if (texto.trim()) fuera.push(...campos.filter((el) => el.name === "mes"));
        for (const el of fuera) el.disabled = true;
        setTimeout(() => {
          for (const el of fuera) el.disabled = false;
        });
      }}
      className="flex flex-wrap items-center gap-2 pb-2"
    >
      {categoria && <input type="hidden" name="categoria" value={categoria} />}
      {fecha && <input type="hidden" name="fecha" value={fecha} />}
      {mes && <input type="hidden" name="mes" value={mes} />}

      <input
        type="search"
        name="q"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar evento o lugar…"
        aria-label="Buscar evento o lugar"
        className={`${CAMPO} min-w-0 flex-1 basis-56`}
      />

      <select
        name="venue"
        value={lugar}
        aria-label="Filtrar por lugar"
        onChange={(e) => {
          setLugar(e.target.value);
          e.currentTarget.form?.requestSubmit();
        }}
        className={`${CAMPO} max-w-full`}
      >
        <option value="">Todos los lugares</option>
        {venues.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.total})
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="border border-linea px-5 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ceniza transition-colors hover:border-cal hover:text-cal"
      >
        Buscar
      </button>
    </Form>
  );
}
