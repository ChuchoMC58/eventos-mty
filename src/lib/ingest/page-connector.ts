import { Connector } from "./connector";
import { Category } from "@/lib/events/types";
import { extractJsonLdEvents } from "./jsonld";
import { extractEventsWithLLM } from "./llm";

// Conector para páginas de venues/teatros: intenta JSON-LD primero (gratis y
// estable); si la página no lo trae y llmFallback=true, usa Claude API.
export function pageConnector(opts: {
  slug: string;
  name: string;
  url: string;
  category: Category;
  llmFallback?: boolean;
}): Connector {
  return {
    slug: opts.slug,
    name: opts.name,
    async fetchEvents() {
      const res = await fetch(opts.url, { headers: { "user-agent": "eventos-mty/1.0" } });
      if (!res.ok) throw new Error(`${opts.slug} HTTP ${res.status}`);
      const html = await res.text();
      const viaJsonLd = extractJsonLdEvents(html, { category: opts.category, city: "monterrey" });
      if (viaJsonLd.length > 0 || !opts.llmFallback) return viaJsonLd;
      return extractEventsWithLLM(html, { category: opts.category, city: "monterrey" });
    },
  };
}
