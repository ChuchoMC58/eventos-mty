# Salir del Sandbox: sender de producción de Meta + plantillas

> Investigado el 2026-07-28. **Los precios y requisitos de Meta cambian seguido**
> (hay cambios activos este trimestre, ver "Cosas con fecha"). Volver a verificar
> las cifras contra las fuentes del final antes de gastar dinero.

## Por qué esto bloquea el proyecto

Hoy `WHATSAPP_TEST_MODE=true` y **todo mensaje va al número del admin**. No se puede
apagar porque el Sandbox solo entrega a números que hayan hecho `join`, y porque
fuera de la ventana de 24 h no se puede mandar texto libre.

**La ventana de 24 h NO desaparece con un sender aprobado** — es la regla central de
la plataforma, no una limitación del Sandbox. Lo que se gana con la solicitud son las
**plantillas**, que son la única forma autorizada de escribir fuera de esa ventana.

Un usuario real que se registra nunca nos ha escrito ⇒ no tiene ventana abierta ⇒ el
OTP en texto libre **siempre** rebota. Por eso nadie más que el admin puede ni
siquiera hacer login hoy.

## Los tres mensajes de la app y su categoría

Meta cobra por mensaje de plantilla entregado, y la categoría define el precio.

| Mensaje | Dónde | Categoría | Notas |
|---|---|---|---|
| OTP de login | `src/lib/auth/otp.ts:13` | **Authentication** | Cuerpo **fijado por Meta**, no editable |
| Recordatorio de evento guardado | `src/lib/reminders/run.ts:42` | **Utility** | Ligado a una acción del usuario (guardó el evento) |
| Digest semanal | `src/lib/digest/run.ts:33` | **Marketing** (probable) | Es contenido promocional no solicitado puntualmente |

**Ojo con la clasificación:** Meta recategoriza plantillas por su contenido. Si el
digest se manda como "utility" y Meta lo lee como marketing, lo recategoriza y cobra
la tarifa alta. Marketing además **no tiene descuentos por volumen** a propósito.

## Precios (base de Meta, México, consultados 2026-07-28)

| Categoría | Base Meta | Con markup de BSP (~$0.003–0.010) |
|---|---|---|
| Utility | $0.0080 | ~$0.011–0.018 |
| Authentication | $0.0207 | ~$0.024–0.031 |
| Marketing | $0.0436 | ~$0.047–0.054 |

Gratis: cualquier mensaje **dentro** de la ventana de 24 h abierta por el usuario, y
las plantillas *utility* enviadas dentro de esa ventana. Para esta app eso casi nunca
aplica (nuestros envíos son iniciados por nosotros, fuera de ventana).

Orden de magnitud con 100 usuarios: el digest semanal como marketing son ~430
mensajes/mes ≈ **$20–23 USD/mes**. Los recordatorios, siendo utility, son calderilla.
El OTP se paga por login, no por usuario.

## ✅ ESTADO DEL TRÁMITE (2026-07-29): SENDER REGISTRADO Y ONLINE

**El Embedded Signup se completó.** El sender de producción está vivo:

```
whatsapp:+17347670241 | status: ONLINE | display name: Vibra MX
messaging_limit: 250 Customers/24hr | quality_rating: UNKNOWN (sin tráfico aún)
```

Cómo se destrabó: el código de verificación se pidió **por llamada** (el SMS es
imposible, ver abajo) y se capturó con el `<Record>` de respaldo — el reenvío al
celular salió `no-answer`, así que sin ese respaldo se habría perdido el intento.

**Después de meter el código**, Meta muestra una "Guía de configuración" de 6 pasos.
Solo dos importan:

- **"Conectando número de teléfono a Twilio" → botón `Actualizar`.** No es cosmético:
  hasta darle, Twilio reporta el sender `OFFLINE` con `63112` ("WhatsApp Business
  Accounts connected to this Sender were disabled by Meta"). **Ese error es
  transitorio** — 21 s después de `Actualizar` pasó a `ONLINE`. No abrir ticket.
- **"Verifica tu negocio"** — es la que quita el tope de 250 conversaciones/24 h.
  Meta prometió respuesta en **2 días** al enviarla (2026-08-01). Independiente de
  todo lo demás.

Los otros cuatro (escanear QR, "enviar el primer mensaje", el tutorial de plantillas,
y la cuenta ya conectada) son opcionales o se completan solos.

### Plantillas (2026-07-29)

Creadas por API (`POST https://content.twilio.com/v1/Content` + `POST
/v1/Content/{sid}/ApprovalRequests/whatsapp` con `name` y `category`):

| Plantilla | ContentSid | Categoría | Estado |
|---|---|---|---|
| `vibramx_recordatorio_evento_guardado` | `HXdfa8086a05d711d7feaf5d52ce6d9e4b` | **UTILITY** | ✅ **APROBADA** ← **la buena** |
| `vibramx_digest_semanal_v2` | `HX626b23de0d02f571a3a841967d6667b9` | MARKETING | ✅ **APROBADA** ← **la buena** |
| `vibramx_otp_login` | — | AUTHENTICATION | 🔴 **BLOQUEADA** |

Las dos de respaldo (`HX97332f…`, `HX93686b…`) **se borraron el 2026-07-31**
(`DELETE /v1/Content/{sid}` → 204) una vez aprobadas las buenas: tenían los bugs de
copy y sólo servían para que alguien las conectara por error.

**Aprobadas las cuatro el 2026-07-31** (enviadas el 29 ~01:00 y ~01:50 UTC; tardaron
~1.5 días, más que las "pocas horas" que uno esperaría, sin ningún aviso intermedio —
el estado sólo salta de `pending` a `approved`).

**🎉 La apuesta de UTILITY salió:** Meta **respetó la categoría** del recordatorio y no
la recategorizó, pese a que el envío llevaba `allow_category_change: true`. O sea que
quitar el "conseguir boletos si todavía quedan" y encuadrarlo como "tu evento guardado"
sí bastó. Los recordatorios salen a tarifa UTILITY, más barata que MARKETING en México.

**Limpieza hecha:** los dos respaldos se borraron el 2026-07-31.

**⚠️ Corrección:** este documento decía que `vibramx_recordatorio_evento` era UTILITY.
**No lo era** — la API la reporta como MARKETING. Se envió así y el dato quedó mal
anotado. Verificar contra la API, no contra la tabla:
`GET https://content.twilio.com/v1/ContentAndApprovals`.

#### Por qué se rehízo el recordatorio como UTILITY (2026-07-29)

Una plantilla enviada **no se puede editar**: para cambiar categoría o cuerpo hay que
crear otra y volver a revisión. Se hizo por dos razones que se arreglaban juntas:

1. **La categoría.** El cuerpo viejo cerraba con "…y **conseguir boletos si todavía
   quedan**" — lenguaje de venta, que es lo que empuja a Meta a clasificarla MARKETING.
   UTILITY es más barata por mensaje en México y no exige la línea de opt-out. Para
   que califique, el cuerpo tiene que ser informativo **sobre algo que el usuario
   hizo**: por eso el título dice "de tu evento guardado", que es la señal explícita.
2. **El "Mañana es …" fijo.** Ver `HANDOFF.md`; en resumen, la palabra hoy/mañana se
   movió del cuerpo aprobado a la variable `{{2}}` (`formatCuando`), para que el mismo
   texto siga siendo cierto cuando el cron pase a ventana de 12–36 h. Congelar
   "Mañana" habría costado otra plantilla y otra revisión.

Cuerpo nuevo (`{{1}}` título, `{{2}}` cuándo, `{{3}}` sede, `{{4}}` id en la URL del botón):

```
Recordatorio de tu evento guardado 📅

"{{1}}"
Cuándo: {{2}}
Dónde: {{3}}

Toca el botón para ver los detalles.
```

**La MARKETING vieja se dejó viva a propósito**, como respaldo por si Meta rechaza la
UTILITY. Si aprueban las dos, borrar la vieja y quedarse con `HXdfa8086a…`.

#### Por qué se rehízo el digest (2026-07-29)

Mismo patrón, otro dato congelado en el cuerpo. El viejo decía:

> ¡Hola! 👋 Esta semana hay **{{1}}** **eventos** en **Monterrey** que cruzan con tus gustos.

Tres problemas, los tres por texto fijo que en realidad depende de los datos:

1. **`eventos` en plural fijo.** `runDigest` sólo se salta el envío cuando hay CERO
   coincidencias, así que con una sola el mensaje decía **"hay 1 eventos"** — y un
   usuario con intereses específicos cae ahí seguido. Ahora `{{1}}` carga la cuenta
   **con su sustantivo** ("1 evento" / "7 eventos"), armado en `plantillaDigest`.
2. **`Monterrey` fijo**, contra la expansión nacional que ya está en el plan. Ahora es
   `{{2}}`, desde `User.city` (que ya existía en el esquema) pasando por `nombreCiudad`.
   `runDigest` también dejó de filtrar eventos por `city: "monterrey"`: consulta las
   ciudades que de hecho tienen usuarios ese día y cada quien cuenta la suya.
3. **`Esta semana`** cuando el horizonte de la consulta son **10 días**. Ahora dice
   "En los próximos días".

**Trampa de concordancia:** la frase no puede llevar **ningún verbo que se refiera a la
cuenta**. El "que **van** con tus gustos" del original se rompe igual que el plural del
sustantivo ("hay 1 evento … que van"), y arreglar sólo el sustantivo habría cambiado un
bug por otro. Por eso el cuerpo nuevo termina en "para ti, según tus gustos", sin verbo:

```
¡Hola! 👋 En los próximos días hay {{1}} en {{2}} para ti, según tus gustos.

Responde BAJA para dejar de recibir este resumen.
```

El "Responde BAJA" se conserva: MARKETING exige opt-out, y el webhook hace
`.trim().toLowerCase()` antes de comparar, así que BAJA/baja/" Baja " entran igual
(`src/app/api/whatsapp/webhook/route.ts:14`).

**Regla general que dejaron las dos plantillas:** un cuerpo aprobado por Meta no se
edita. Todo lo que dependa de los datos —fecha relativa, plural, ciudad, sede— tiene
que viajar en una variable, aunque hoy parezca constante.

**Ojo con `allow_category_change: true`** (viene por defecto en el envío): si Meta no
está de acuerdo con UTILITY **no rechaza — recategoriza a MARKETING en silencio**. Por
eso al revisar el resultado no basta ver `status: approved`; hay que mirar también el
campo `category`. (Esta vez **no** se disparó: el recordatorio quedó UTILITY. Pero la
verificación sigue siendo obligatoria en cada envío futuro.)

**🔴 El OTP está bloqueado por la verificación del negocio.** Meta rechaza crear
plantillas de categoría AUTHENTICATION si el negocio no está verificado:

```
2388185 — This WhatsApp business account does not have permission to
          create message template
```

No hay rodeo: mandar un código en una plantilla de otra categoría viola la política
y Meta la recategoriza. **La verificación del negocio no es opcional ni "para subir
el límite": es lo que desbloquea el login por WhatsApp.** Decisión tomada el
2026-07-29: esperar la verificación en vez de mover el OTP a SMS.

**Otro rechazo ya resuelto:** `2388293` ("too many variables for its length") — el
recordatorio tenía 4 variables sobre un cuerpo de ~50 caracteres. Se recreó con un
cuerpo más largo. Meta mide la proporción variables/longitud, no solo el conteo.

### ⛔ NO DEPLOYAR el refactor de plantillas todavía

El código ya migró a plantillas (`sendPlantilla`), y eso incluye el OTP. Como la
plantilla de OTP **no existe**, `plantillaOtp()` lanza `Falta
TWILIO_CONTENT_SID_OTP` y **el login se cae**. Antes de pushear hacen falta:

1. ~~Que Meta apruebe recordatorio y digest.~~ ✅ **HECHO (2026-07-31).**
2. 🔴 Que exista la plantilla de OTP (o sea: verificación del negocio lista).
   **Éste es ahora el ÚNICO bloqueo del deploy.** Ojo: el fallback de texto libre que
   se agregó el 2026-07-31 **NO destraba esto** — está atado a
   `WHATSAPP_TEST_MODE=true` a propósito, y en producción `sendPlantilla` sigue
   lanzando si falta el ContentSid. Sirve para probar en local, no para deployar.
3. Las variables de entorno en Coolify: `TWILIO_CONTENT_SID_OTP`,
   `TWILIO_CONTENT_SID_RECORDATORIO=HXdfa8086a05d711d7feaf5d52ce6d9e4b` (la UTILITY,
   **no** la vieja `HX97332f…`),
   `TWILIO_CONTENT_SID_DIGEST=HX626b23de0d02f571a3a841967d6667b9` (la v2, **no** la
   vieja `HX93686b…`), y
   `TWILIO_WHATSAPP_FROM=+17347670241` (hoy sigue en el Sandbox).
4. Solo al final, `WHATSAPP_TEST_MODE=false`.

**Ya decidido y usado en el formulario:**

| Campo | Valor |
|---|---|
| Nombre de la empresa (portfolio) | El nombre legal del usuario |
| Nombre visible / display name | `Vibra MX` |
| Categoría | Entretenimiento |
| Sitio web | `https://vibramx.fun/` (validó con palomita en el form) |
| País / Primary Business Location | México |
| Número del sender | `+1 734 767 0241` |

**Número comprado en Twilio (2026-07-28):** `+1 734 767 0241`, ~$1.15/mes, con
**SMS y voz**. Los identificadores (SID del número, SID del sender) están en la
memoria privada del agente, no aquí — este repo es público.

### Por qué un número de EE.UU. y no mexicano

Se estuvo a punto de comprar un `+52` y se descartó. El razonamiento, por si hay
que revisarlo:

- Los `+52` en Twilio salen **$6.25/mes**, son **solo voz** (sin SMS) y exigen un
  **bundle regulatorio con domicilio en México** — trámite con revisión, que frenaba
  el avance ese mismo día.
- **El costo de los mensajes NO cambia:** Meta cobra por el país **del destinatario**,
  no del remitente. Mandar desde un `+1` a usuarios mexicanos cuesta tarifa de México.
- El recargo *authentication-international* **no aplica**: su lista es India,
  Indonesia, Egipto, Malasia, Nigeria, Pakistán, Arabia Saudita, Sudáfrica y EAU
  (México no está), lo dispara la *Primary Business Location* (que es México, no el
  país del número) y además exige >750,000 conversaciones/30 días.
- Lo único que se pierde es **imagen de marca**: un usuario que abra "Info del
  negocio" verá un `+1`. Pesaba poco porque **todavía no hay usuarios**.
- **No ata a nada:** las plantillas viven en la WABA y la verificación en el
  portfolio, no en el número. Se puede añadir un `+52` como segundo sender más
  adelante (hasta 2 números sin verificación) sin rehacer trabajo.

### ⚠️ Trampas ya pisadas en el Embedded Signup

1. **NO elegir "Usar solo un nombre visible."** Esa opción asigna un número virtual
   que provee WhatsApp (los "555"), y **Twilio no soporta números provistos por
   WhatsApp**. Deja un sender que Meta acepta pero que la integración no puede usar.
   Hay que elegir "Agregar un número nuevo".
2. **El "Nombre de la empresa" NO es el display name.** El primero es interno (Meta
   lo contrasta contra documentos en la verificación); el segundo es el que ven los
   usuarios. La pantalla avisa que deben coincidir: como aquí el nombre legal es una
   persona y el visible es `Vibra MX`, **el respaldo es el dominio `vibramx.fun`**.
   Si Meta rechaza el display name → **250 mensajes iniciados por el negocio cada
   24 h** y posible desconexión del sender.
3. **La verificación por SMS NO FUNCIONA con un número de Twilio.** Es filtrado A2P
   de operadora: los short codes (Meta, Google, Apple) tienen prohibido entregar a
   números VoIP, y el SMS **se descarta en la red antes de llegar a Twilio**. En los
   logs no aparece nada — ni el mensaje ni un error, porque nunca tocó la plataforma.
   Se perdió un buen rato buscándolo. **Hay que pedir el código por LLAMADA.**
4. **La llamada sí llega** (entró desde `+1 224 206 3830`, 9 s). Pero el número es
   virtual: no suena ningún teléfono. Hay que decidir qué hace Twilio con ella
   (ver abajo).
5. **La transcripción de Twilio es inútil para dígitos dictados.** Devolvió
   `"To go because they the fee ceiling is C A D, we are sorry, an application error
   has occurred"` — puro ruido, incluida una frase de error que no ocurrió (la
   llamada se completó y no hubo alertas). **Usar el audio, no la transcripción.**

### Captura de la llamada — RESUELTO con twimlet (sin túnel, 2026-07-28)

El montaje anterior apuntaba el `voice_url` a un **túnel de Cloudflare temporal**, que
moría al cerrar la sesión y dejaba el número apuntando a un host muerto. **Ya no.**

Ahora el `voice_url` apunta a un **twimlet** (`twimlets.com/echo`, hospedado por
Twilio, público y permanente — no hay servidor propio que se caiga):

```xml
<Response>
  <Dial callerId="+17347670241" timeout="15" record="record-from-answer">+529223736016</Dial>
  <Record maxLength="90" playBeep="false" trim="do-not-trim"/>
</Response>
```

Se configura con
`POST /2010-04-01/Accounts/{SID}/IncomingPhoneNumbers/{PN_SID}.json` y
`VoiceUrl=https://twimlets.com/echo?Twiml={TwiML url-encodeado}`.

Cubre los tres casos: si el usuario contesta escucha el código en vivo **y** queda
grabado; si no alcanza a contestar, el `<Dial>` expira a los 15 s y el `<Record>`
graba a Meta dictando. Siempre queda un `.mp3` en `/Recordings/{RE_SID}.mp3`.

**Ojo:** para **voz** el número mexicano va **sin** el `1` — `+529223736016`. El `1`
es peculiaridad de WhatsApp, no de la red telefónica.

#### Verificado el 2026-07-28 (antes de gastar intentos de Meta)

Meta bloquea el número tras varios intentos fallidos, así que el camino se probó
completo con llamadas propias primero:

- **Webhook de entrada:** el usuario marcó al `+1 734 767 0241` con el `voice_url`
  apuntado temporalmente a un `<Say>` de prueba → `completed`, 17 s, **0 alertas**.
  (Con el túnel muerto esto habría dado un error 11200 "HTTP retrieval failure".)
- **Reenvío al celular:** llamada saliente de Twilio al `+529223736016` →
  `completed`, 14 s, contestada. `callerId` respetado.
- **No se puede probar el ciclo completo de un tiro:** Twilio rechaza que el número
  se llame a sí mismo (**error 21216**, "Account not allowed to call"). Hay que
  partirlo en las dos pruebas de arriba.
- **El audio del reenvío es peor que el directo:** en la llamada reenviada solo se
  entendieron los primeros dígitos; marcando directo se oyeron los seis. La
  degradación está en la pata Twilio→celular. Por eso el `record` no es opcional:
  la grabación se hace **en Twilio, antes del reenvío**, así que el `.mp3` conserva
  el audio bueno.
- **Cero SMS entrantes** al número en toda la vida de la cuenta — confirma que el
  filtrado A2P descarta los intentos por SMS antes de tocar Twilio.

## El trámite, en orden

1. **Cuenta de Twilio en modo Upgraded.** ✅ Ya está (se hizo el 2026-07-24).
2. **Meta Business Portfolio** con acceso de administrador. Se puede crear durante el
   Self Sign-up de Twilio si no existe.
3. **Verificación del negocio ante Meta.** ⏳ **PENDIENTE — es el bloqueo actual.**
   Pide documentación real del negocio. No es
   solo para subir el límite de 250: **sin ella no existe la plantilla de OTP**, o
   sea no hay login por WhatsApp para usuarios reales.
4. **WABA + registro del sender** vía Self Sign-up de Twilio. ✅ Hecho el 2026-07-29
   — ver "Estado del trámite" arriba. Requisitos del número:
   - Puede ser de Twilio o propio; **puede ser mexicano (+52)**.
   - **NO debe estar ya registrado en WhatsApp** (si tu número personal tiene
     WhatsApp, no sirve — hay que darlo de baja de WhatsApp primero o usar otro).
   - Debe poder recibir SMS o llamada para el OTP de verificación. ⚠️ **Con un
     número de Twilio, el SMS no llega (filtrado A2P) — usar llamada.**
   - Nada de IVR / solo-salida.
5. **Display name.** `Vibra MX`, aceptado en el registro. Meta lo revisa *después*;
   si lo rechaza, el sender queda limitado a **250 mensajes iniciados por el negocio
   cada 24 h** y puede desconectarse.
6. **Plantillas, una por una, cada una aprobada por Meta.** ✅ Recordatorio y digest
   **aprobadas (2026-07-31)**; 🔴 OTP bloqueado por el paso 3.

## Impacto en el código — ✅ HECHO (2026-07-29)

Mandar una plantilla **no es mandar `body`**: va `contentSid` + `contentVariables`.
Lo que cambió:

- `MessageSender.create` ahora recibe `{ from, to, contentSid, contentVariables }`.
  `sendWhatsApp` fue reemplazada por **`sendPlantilla`**, y las tres plantillas se
  construyen con `plantillaOtp`, `plantillaRecordatorio` y `plantillaDigest`
  (`src/lib/whatsapp.ts`), que leen su `ContentSid` del entorno.
- **El texto del OTP lo fija Meta.** El nuestro ("Tu código de acceso a Eventos MTY
  es X…") desapareció; llega el cuerpo de Meta con botón de "copiar código".
- **El `+521` de salida quedó arreglado:** `mxWhatsAppNumber`
  (`src/lib/auth/phone.ts`) repone el `1` sobre el canónico de la BD, y es
  idempotente. Los fixtures de los tests de BD usaban teléfonos imposibles
  (`+5281000001` = `+52` + 8 dígitos, que `normalizeMxPhone` nunca produce) y por eso
  se veían "correctos" antes; ahora usan números de 10 dígitos.
- **El recordatorio perdió el enlace condicional de boletos**: las plantillas no
  admiten segmentos opcionales, así que el botón apunta siempre a la página del
  evento, que ya enlaza los boletos cuando existen.
- **El digest perdió la lista dentro del mensaje** y se volvió un gancho con la
  cuenta de eventos + botón. `buildDigestMessage` y su test se borraron: el número de
  variables de una plantilla es fijo y Meta no acepta parámetros vacíos, así que una
  plantilla de N eventos truena con quien tenga menos.
- **El webhook de "baja" NO cambió**: responde con TwiML dentro de la ventana de 24 h,
  que es texto libre permitido.

## Pendientes ligados que se destraban con esto

- ~~**`+521` del lado del envío**~~ ✅ arreglado el 2026-07-29 con `mxWhatsAppNumber`.
- **Reintento real de recordatorios:** cron cada hora + ventana 12–36 h + tope de
  intentos (`reminderAttempts`). Sin plantillas no sirve: reintentar contra un
  63016 solo repite el mismo rechazo y **baja la calificación de calidad del sender**,
  que es lo que Meta usa para limitar o pausar plantillas.
- ~~**Opt-out completo**~~ ✅ hecho el 2026-07-29. `User.optOutAt` (fecha, no
  booleano, para poder demostrar cuándo se respetó) apaga digest **y**
  recordatorios; las dos consultas lo filtran. `digestDay` se conserva intacto para
  que reactivar desde el perfil devuelva la preferencia como estaba.
- ~~**La palabra "baja" no se anuncia**~~ ✅ hecho. El perfil lo dice, y quien está
  dado de baja ve un aviso con botón de "Volver a recibir mensajes".

## Cosas con fecha (verificar, cambian rápido)

- **Facturación en MXN:** Meta migró México a precios en moneda local desde el
  2026-04-01.
- **Tarifas vigentes desde 2026-07-01** — las tablas de arriba son de esa revisión.
- **Mensajes de servicio dejan de ser gratis el 2026-10-01**; Meta publica tarifas
  finales antes del 2026-09-01. Hoy los mensajes dentro de la ventana de 24 h son
  gratis, y eso **va a dejar de ser cierto**.

## Alternativa que conviene considerar antes de gastar

Para el **OTP** específicamente, SMS no requiere plantillas ni verificación de negocio
y se puede encender hoy. Serviría para desbloquear el registro de usuarios reales
mientras el trámite de Meta avanza, dejando WhatsApp para recordatorios y digest.
Cambia la propuesta de "todo por WhatsApp", así que es decisión de producto.

## Fuentes

- https://www.twilio.com/docs/whatsapp/self-sign-up
- https://www.twilio.com/docs/whatsapp/tutorial/whatsapp-business-account
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- https://www.twilio.com/docs/content/whatsappauthentication
- https://support.twilio.com/hc/en-us/articles/15596541039771-WhatsApp-Authentication-Template-Requirements-Restrictions-and-International-Fees
