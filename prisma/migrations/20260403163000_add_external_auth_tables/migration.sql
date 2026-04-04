CREATE TABLE "AuthAccount" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "providerUsername" TEXT,
  "providerEmail" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthPasskey" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "credentialId" TEXT NOT NULL,
  "credentialPublicKey" TEXT NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "deviceType" TEXT,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "transports" TEXT,
  "name" TEXT,
  "lastUsedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthPasskey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "AuthAccount"("provider", "providerAccountId");
CREATE INDEX "AuthAccount_userId_provider_idx" ON "AuthAccount"("userId", "provider");

CREATE UNIQUE INDEX "AuthPasskey_credentialId_key" ON "AuthPasskey"("credentialId");
CREATE INDEX "AuthPasskey_userId_createdAt_idx" ON "AuthPasskey"("userId", "createdAt");
CREATE INDEX "AuthPasskey_lastUsedAt_idx" ON "AuthPasskey"("lastUsedAt");

ALTER TABLE "AuthAccount"
  ADD CONSTRAINT "AuthAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthPasskey"
  ADD CONSTRAINT "AuthPasskey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
