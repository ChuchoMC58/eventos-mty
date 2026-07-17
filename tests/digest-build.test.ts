import { describe, it, expect } from "vitest";
import { buildDigestMessage, DigestEvent } from "@/lib/digest/build";

const ev = (i: number): DigestEvent => ({
  title: `Evento número ${i} con nombre razonablemente largo`,
  startsAt: new Date("2026-07-16T21:00:00"),
  venueName: "Arena Monterrey",
});
const opts = { webUrl: "https://eventos-mty.app" };

describe("buildDigestMessage", () => {
  it("cero coincidencias → null (no se envía nada)", () => {
    expect(buildDigestMessage([], opts)).toBeNull();
  });

  it("pocos eventos: lista todos, sin línea de desborde, con link y BAJA", () => {
    const msg = buildDigestMessage([ev(1), ev(2)], opts)!;
    expect(msg).toContain("Evento número 1");
    expect(msg).toContain("Evento número 2");
    expect(msg).not.toContain("eventos más");
    expect(msg).toContain(opts.webUrl);
    expect(msg).toContain("BAJA");
  });

  it("muchos eventos: respeta el límite y desborda a link", () => {
    const eventos = Array.from({ length: 25 }, (_, i) => ev(i + 1));
    const msg = buildDigestMessage(eventos, { ...opts, maxChars: 500 })!;
    expect(msg.length).toBeLessThanOrEqual(500);
    expect(msg).toMatch(/…y \d+ eventos más/);
  });
});
