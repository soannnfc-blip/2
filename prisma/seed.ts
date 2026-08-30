import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { seedDemoData } from "./demo-data";

const db = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL ?? "soann.nfc@gmail.com";
  const existing = await db.user.findUnique({ where: { email } });

  if (!existing) {
    const password = process.env.OWNER_PASSWORD ?? randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);

    await db.user.create({ data: { email, passwordHash, name: "Soann" } });

    console.log("Compte propriétaire créé.");
    console.log(`  Email: ${email}`);
    if (!process.env.OWNER_PASSWORD) {
      console.log(`  Mot de passe temporaire: ${password}`);
      console.log("  -> à changer dès la première connexion.");
    }
  } else {
    console.log(`Utilisateur déjà existant: ${email}`);
  }

  console.log("Chargement des données de démonstration...");
  await seedDemoData(db);
  console.log("Données de démonstration prêtes (clients, ventes, emails, agenda, tâches, dépenses).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
