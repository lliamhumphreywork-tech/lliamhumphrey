import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  // Seed spaces
  const spaces = [
    { name: "Talent Network", slug: "talent-network", emoji: "🤝", description: "External talent available to hire into your business", sortOrder: 0 },
    { name: "Resources", slug: "resources", emoji: "📚", description: "SOPs, templates, tools, and recordings", sortOrder: 1 },
    { name: "Wins", slug: "wins", emoji: "🏆", description: "Celebrate your progress", sortOrder: 2 },
  ]

  for (const space of spaces) {
    await db.space.upsert({
      where: { slug: space.slug },
      update: {},
      create: space,
    })
  }

  // Set admin role for Lliam
  await db.user.updateMany({
    where: { email: "lliam@privatevictoriesclub.com" },
    data: { role: "ADMIN" },
  })

  console.log("Seeded spaces and admin role")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
