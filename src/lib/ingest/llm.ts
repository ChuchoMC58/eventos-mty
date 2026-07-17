import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { NormalizedEvent, Category } from "@/lib/events/types";

export interface LlmClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      messages: Array<{ role: "user"; content: string }>;
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

const LlmEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startsAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), "fecha inválida"),
  venueName: z.string().min(1),
  priceMin: z.number().optional(),
  ticketUrl: z.string().optional(),
});

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50_000);
}

export async function extractEventsWithLLM(
  html: string,
  opts: { category: Category; city: string; client?: LlmClient },
): Promise<NormalizedEvent[]> {
  const client: LlmClient = opts.client ?? new Anthropic();
  const text = htmlToText(html);
  const res = await client.messages.create({
    model: process.env.LLM_MODEL ?? "claude-sonnet-5",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content:
          `Extrae los eventos (con fecha futura concreta) del siguiente texto de una página de eventos de ${opts.city}. ` +
          `Responde ÚNICAMENTE un arreglo JSON, sin texto adicional, con objetos: ` +
          `{"title": string, "startsAt": string ISO 8601 (asume el año en curso si no se indica), "venueName": string, ` +
          `"description"?: string, "priceMin"?: number, "ticketUrl"?: string}. ` +
          `Si no hay eventos, responde [].\n\nTEXTO:\n${text}`,
      },
    ],
  });

  const raw = res.content.find((c) => c.type === "text")?.text ?? "[]";
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const events: NormalizedEvent[] = [];
  for (const item of parsed) {
    const r = LlmEventSchema.safeParse(item);
    if (!r.success) continue; // entrada inválida: se descarta, no tumba la corrida
    events.push({
      title: r.data.title,
      description: r.data.description,
      startsAt: new Date(r.data.startsAt),
      category: opts.category,
      tags: [],
      priceMin: r.data.priceMin,
      ticketUrl: r.data.ticketUrl,
      status: "activo",
      venue: { name: r.data.venueName },
      city: opts.city,
    });
  }
  return events;
}
