CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'WAIT_BUYER_PAY', 'PAID', 'CLOSED', 'FAILED', 'REFUNDING', 'REFUNDED');

CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CLOSED');

CREATE TYPE "PaymentFulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "PaymentOrder" (
  "id" TEXT NOT NULL,
  "merchantOrderNo" TEXT NOT NULL,
  "bizScene" TEXT NOT NULL,
  "bizOrderId" TEXT,
  "userId" INTEGER,
  "subject" TEXT NOT NULL,
  "body" TEXT,
  "clientType" TEXT NOT NULL,
  "amountFen" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "providerCode" TEXT NOT NULL,
  "channelCode" TEXT NOT NULL,
  "routeSnapshotJson" JSONB,
  "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
  "providerTradeNo" TEXT,
  "providerBuyerId" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "paidAt" TIMESTAMPTZ(3),
  "closedAt" TIMESTAMPTZ(3),
  "expiredAt" TIMESTAMPTZ(3),
  "fulfillmentStatus" "PaymentFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  "fulfilledAt" TIMESTAMPTZ(3),
  "fulfillmentErrorMessage" TEXT,
  "metadataJson" JSONB,
  "rawSuccessPayloadJson" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "attemptNo" INTEGER NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'checkout',
  "providerCode" TEXT NOT NULL,
  "channelCode" TEXT NOT NULL,
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "presentationType" TEXT,
  "requestPayloadJson" JSONB,
  "responsePayloadJson" JSONB,
  "providerTraceId" TEXT,
  "redirectUrl" TEXT,
  "formHtml" TEXT,
  "qrCode" TEXT,
  "providerTradeNo" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentNotification" (
  "id" TEXT NOT NULL,
  "orderId" TEXT,
  "providerCode" TEXT NOT NULL,
  "channelCode" TEXT,
  "notifyType" TEXT,
  "notifyId" TEXT,
  "merchantOrderNo" TEXT,
  "providerTradeNo" TEXT,
  "tradeStatus" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "handled" BOOLEAN NOT NULL DEFAULT false,
  "payloadJson" JSONB NOT NULL,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handledAt" TIMESTAMPTZ(3),

  CONSTRAINT "PaymentNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "refundNo" TEXT NOT NULL,
  "amountFen" INTEGER NOT NULL,
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "providerRefundNo" TEXT,
  "providerResultJson" JSONB,
  "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentOrder_merchantOrderNo_key" ON "PaymentOrder"("merchantOrderNo");
CREATE UNIQUE INDEX "PaymentOrder_providerTradeNo_key" ON "PaymentOrder"("providerTradeNo");
CREATE UNIQUE INDEX "PaymentAttempt_orderId_attemptNo_key" ON "PaymentAttempt"("orderId", "attemptNo");
CREATE UNIQUE INDEX "PaymentRefund_refundNo_key" ON "PaymentRefund"("refundNo");

CREATE INDEX "PaymentOrder_bizScene_bizOrderId_createdAt_idx" ON "PaymentOrder"("bizScene", "bizOrderId", "createdAt");
CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");
CREATE INDEX "PaymentOrder_status_createdAt_idx" ON "PaymentOrder"("status", "createdAt");
CREATE INDEX "PaymentOrder_fulfillmentStatus_createdAt_idx" ON "PaymentOrder"("fulfillmentStatus", "createdAt");
CREATE INDEX "PaymentOrder_providerCode_channelCode_createdAt_idx" ON "PaymentOrder"("providerCode", "channelCode", "createdAt");
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON "PaymentAttempt"("orderId", "createdAt");
CREATE INDEX "PaymentAttempt_providerCode_channelCode_createdAt_idx" ON "PaymentAttempt"("providerCode", "channelCode", "createdAt");
CREATE INDEX "PaymentNotification_orderId_receivedAt_idx" ON "PaymentNotification"("orderId", "receivedAt");
CREATE INDEX "PaymentNotification_providerCode_notifyId_receivedAt_idx" ON "PaymentNotification"("providerCode", "notifyId", "receivedAt");
CREATE INDEX "PaymentNotification_merchantOrderNo_receivedAt_idx" ON "PaymentNotification"("merchantOrderNo", "receivedAt");
CREATE INDEX "PaymentRefund_orderId_requestedAt_idx" ON "PaymentRefund"("orderId", "requestedAt");
CREATE INDEX "PaymentRefund_status_requestedAt_idx" ON "PaymentRefund"("status", "requestedAt");

ALTER TABLE "PaymentOrder"
  ADD CONSTRAINT "PaymentOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentNotification"
  ADD CONSTRAINT "PaymentNotification_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRefund"
  ADD CONSTRAINT "PaymentRefund_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
