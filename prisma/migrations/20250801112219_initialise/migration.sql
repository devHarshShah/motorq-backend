-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('CAR', 'BIKE', 'EV', 'HANDICAP_ACCESSIBLE');

-- CreateEnum
CREATE TYPE "public"."SlotStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."BillingType" AS ENUM ('HOURLY', 'DAY_PASS');

-- CreateTable
CREATE TABLE "public"."Vehicle" (
    "id" TEXT NOT NULL,
    "numberPlate" TEXT NOT NULL,
    "type" "public"."VehicleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Slot" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" "public"."VehicleType" NOT NULL,
    "status" "public"."SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Staff" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" TIMESTAMP(3),
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingType" "public"."BillingType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Billing" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "public"."BillingType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Billing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_numberPlate_key" ON "public"."Vehicle"("numberPlate");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_location_key" ON "public"."Slot"("location");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_employeeId_key" ON "public"."Staff"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Billing_sessionId_key" ON "public"."Billing"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "public"."Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Billing" ADD CONSTRAINT "Billing_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
