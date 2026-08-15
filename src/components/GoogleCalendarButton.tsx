"use client";
import { useSyncExternalStore } from "react";
import { BOTON_SECUNDARIO } from "@/lib/ui";

// Detecta Android sin provocar mismatch de hidratación: en el server (y en el
// primer render del cliente) devuelve `false`, y tras hidratar lee el userAgent.
// Se usa `useSyncExternalStore` en vez de `useEffect` + `setState` porque esto
// es leer un valor externo, no sincronizar estado (y el lint lo exige).
const suscribir = () => () => {};
const useEsAndroid = () =>
  useSyncExternalStore(
    suscribir,
    () => /Android/i.test(navigator.userAgent),
    () => false,
  );

// Renderiza el botón de Google Calendar. Por defecto (server + primer render en
// cliente) usa el link web `TEMPLATE` con `target="_blank"`. Tras montar, si detecta
// Android, cambia al `intent://` para que el link lo abra la app nativa de Google
// Calendar (ver `androidCalendarIntentUrl`).
//
// OJO: el `intent://` debe navegar en la MISMA pestaña — Chrome bloquea el
// lanzamiento de apps vía intent:// desde una pestaña nueva (`target="_blank"`),
// y termina cayendo al fallback web. Por eso en Android quitamos el target.
export default function GoogleCalendarButton({
  webUrl,
  androidIntentUrl,
}: {
  webUrl: string;
  androidIntentUrl: string;
}) {
  const isAndroid = useEsAndroid();

  return (
    <a
      href={isAndroid ? androidIntentUrl : webUrl}
      {...(isAndroid ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={BOTON_SECUNDARIO}
    >
      Google Calendar
    </a>
  );
}
