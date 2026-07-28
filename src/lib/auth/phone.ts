// Normaliza un teléfono mexicano al formato canónico +52XXXXXXXXXX (10 dígitos).
// Devuelve null si no es un móvil MX válido. Quita todo lo que no sea dígito
// (espacios, guiones, paréntesis) y la lada de país si viene incluida, para que
// "+52 81 8765 4321", "8187654321" y "528187654321" entren como el MISMO usuario.
// Pensado para extenderse a otros países cuando la app crezca fuera de MX.
export function normalizeMxPhone(input: string): string | null {
  const national = mxNationalDigits(input);
  if (!/^\d{10}$/.test(national)) return null;
  return `+52${national}`;
}

// Solo los dígitos nacionales: quita todo lo que no sea dígito y la lada 52 si
// viene incluida. Compartido con el input del login para que pegar
// "+52 81 8765 4321" no meta la lada como parte del número.
//
// El caso "521": WhatsApp identifica a los móviles mexicanos con un 1 extra
// después de la lada (`+5219223736016`), herencia del viejo prefijo de móvil.
// Ese es el formato en el que Twilio entrega el `From` de los mensajes
// entrantes, así que sin quitarlo aquí un número que entra por WhatsApp jamás
// empata con el mismo número guardado desde el login. 13 dígitos que empiezan
// con "521" solo pueden ser eso: lada + el 1 + los 10 nacionales.
export function mxNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) return digits.slice(3);
  return digits.length === 12 && digits.startsWith("52") ? digits.slice(2) : digits;
}
