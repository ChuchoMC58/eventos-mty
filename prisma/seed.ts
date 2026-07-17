import { prisma } from "../src/lib/db";

const inDays = (d: number, h = 20) => {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(h, 0, 0, 0);
  return date;
};

async function main() {
  const source = await prisma.source.upsert({
    where: { slug: "seed" },
    update: {},
    create: { slug: "seed", name: "Datos de ejemplo" },
  });
  const arena = await prisma.venue.upsert({
    where: { name_city: { name: "Arena Monterrey", city: "monterrey" } },
    update: {},
    create: { name: "Arena Monterrey", city: "monterrey", address: "Av. Madero 2500" },
  });
  const estadio = await prisma.venue.upsert({
    where: { name_city: { name: "Estadio BBVA", city: "monterrey" } },
    update: {},
    create: { name: "Estadio BBVA", city: "monterrey", zone: "Guadalupe" },
  });
  const teatro = await prisma.venue.upsert({
    where: { name_city: { name: "Teatro de la Ciudad", city: "monterrey" } },
    update: {},
    create: { name: "Teatro de la Ciudad", city: "monterrey", zone: "Centro" },
  });

  const eventos = [
    { title: "Concierto Sinfónico de Verano", category: "musica", tags: ["clasica"], startsAt: inDays(2), venueId: arena.id, priceMin: 350, priceMax: 1200 },
    { title: "Los Ángeles Azules", category: "musica", tags: ["cumbia"], startsAt: inDays(5), venueId: arena.id, priceMin: 500 },
    { title: "Rayados vs Tigres", category: "deportes", tags: ["soccer", "rayados", "tigres"], startsAt: inDays(4, 19), venueId: estadio.id, priceMin: 300, priceMax: 2500 },
    { title: "Sultanes vs Acereros", category: "deportes", tags: ["beisbol", "sultanes"], startsAt: inDays(8, 18), venueId: estadio.id, priceMin: 120 },
    { title: "La Casa de Bernarda Alba", category: "cultura", tags: ["teatro"], startsAt: inDays(3), venueId: teatro.id, priceMin: 250 },
    { title: "Festival de Danza Folclórica", category: "cultura", tags: ["danza"], startsAt: inDays(9, 17), venueId: teatro.id },
  ];
  for (const e of eventos) {
    await prisma.event.create({ data: { ...e, city: "monterrey", sources: { create: { sourceId: source.id } } } });
  }
  console.log(`Seed: ${eventos.length} eventos creados`);
}

main().finally(() => prisma.$disconnect());
