import { mkdir, writeFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage");

export async function saveFactureBuffer(numero: string, buffer: Buffer) {
  const dir = path.join(STORAGE_ROOT, "factures");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${numero}.pdf`);
  await writeFile(filePath, buffer);
  return filePath;
}
