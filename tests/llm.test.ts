import { describe, it, expect } from "vitest";
import { htmlToText, extractEventsWithLLM } from "@/lib/ingest/llm";

function fakeClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: "text", text: responseText }] }),
    },
  };
}

describe("htmlToText", () => {
  it("quita scripts, estilos y etiquetas", () => {
    const html = `<html><script>var x=1;</script><style>.a{}</style><h1>Concierto</h1><p>10 de agosto</p></html>`;
    expect(htmlToText(html)).toBe("Concierto 10 de agosto");
  });
});

describe("extractEventsWithLLM", () => {
  it("parsea la respuesta JSON del modelo y normaliza", async () => {
    const client = fakeClient(
      `[{"title":"Festival de Jazz","startsAt":"2026-08-15T19:00:00","venueName":"Parque Fundidora","priceMin":200}]`,
    );
    const events = await extractEventsWithLLM("<html>...</html>", {
      category: "musica",
      city: "monterrey",
      client,
    });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Festival de Jazz");
    expect(events[0].venue.name).toBe("Parque Fundidora");
    expect(events[0].category).toBe("musica");
    expect(events[0].status).toBe("activo");
  });

  it("tolera texto alrededor del JSON y descarta entradas inválidas", async () => {
    const client = fakeClient(
      `Aquí están:\n[{"title":"Ok","startsAt":"2026-08-15T19:00:00","venueName":"X"},{"title":"Sin fecha","venueName":"Y"}]\nSaludos`,
    );
    const events = await extractEventsWithLLM("<html/>", { category: "cultura", city: "monterrey", client });
    expect(events).toHaveLength(1);
  });

  it("respuesta sin eventos → arreglo vacío", async () => {
    const events = await extractEventsWithLLM("<html/>", {
      category: "cultura",
      city: "monterrey",
      client: fakeClient("[]"),
    });
    expect(events).toEqual([]);
  });
});
