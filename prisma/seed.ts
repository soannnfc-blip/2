import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const db = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL ?? "soann.nfc@gmail.com";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Utilisateur déjà existant: ${email}`);
    return;
  }

  const password = process.env.OWNER_PASSWORD ?? randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: { email, passwordHash, name: "Soann" },
  });

  console.log("Compte propriétaire créé.");
  console.log(`  Email: ${email}`);
  if (!process.env.OWNER_PASSWORD) {
    console.log(`  Mot de passe temporaire: ${password}`);
    console.log("  -> à changer dès la première connexion.");
  }

  await db.preference.upsert({
    where: { cle: "nom_entreprise" },
    update: {},
    create: { cle: "nom_entreprise", valeur: "NOTEO" },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
