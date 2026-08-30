-- CreateTable
CREATE TABLE "EmailDemo" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "deEmail" TEXT NOT NULL,
    "a" TEXT NOT NULL DEFAULT 'moi@noteo.ai',
    "sujet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "extrait" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "dossier" TEXT NOT NULL DEFAULT 'INBOX',
    "repondu" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmailDemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDemo_threadId_idx" ON "EmailDemo"("threadId");

-- CreateIndex
CREATE INDEX "EmailDemo_date_idx" ON "EmailDemo"("date");

-- CreateIndex
CREATE INDEX "Depense_date_idx" ON "Depense"("date");
