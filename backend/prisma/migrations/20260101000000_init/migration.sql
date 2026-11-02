-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DANCER', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CLASS', 'REHEARSAL', 'TECHNIQUE', 'CROSS_TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DANCER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT,
    "mainDisciplineId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disciplineId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "intensity" INTEGER NOT NULL,
    "energyLevel" INTEGER NOT NULL,
    "restHours" DOUBLE PRECISION,
    "hasDiscomfort" BOOLEAN NOT NULL DEFAULT false,
    "discomfortDescription" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherLink" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dancerId" TEXT NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TeacherLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingPermission" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "shareSummary" BOOLEAN NOT NULL DEFAULT false,
    "shareHistory" BOOLEAN NOT NULL DEFAULT false,
    "shareEnergyRest" BOOLEAN NOT NULL DEFAULT false,
    "shareDiscomfort" BOOLEAN NOT NULL DEFAULT false,
    "shareNotes" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharingPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_mainDisciplineId_idx" ON "User"("mainDisciplineId");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_name_key" ON "Discipline"("name");

-- CreateIndex
CREATE INDEX "Training_userId_date_idx" ON "Training"("userId", "date");

-- CreateIndex
CREATE INDEX "Training_disciplineId_idx" ON "Training"("disciplineId");

-- CreateIndex
CREATE INDEX "TeacherLink_dancerId_status_idx" ON "TeacherLink"("dancerId", "status");

-- CreateIndex
CREATE INDEX "TeacherLink_teacherId_status_idx" ON "TeacherLink"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherLink_teacherId_dancerId_key" ON "TeacherLink"("teacherId", "dancerId");

-- CreateIndex
CREATE UNIQUE INDEX "SharingPermission_linkId_key" ON "SharingPermission"("linkId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mainDisciplineId_fkey" FOREIGN KEY ("mainDisciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLink" ADD CONSTRAINT "TeacherLink_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLink" ADD CONSTRAINT "TeacherLink_dancerId_fkey" FOREIGN KEY ("dancerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingPermission" ADD CONSTRAINT "SharingPermission_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "TeacherLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
