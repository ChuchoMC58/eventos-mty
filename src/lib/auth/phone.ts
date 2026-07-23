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
export function mxNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("52") ? digits.slice(2) : digits;
}
