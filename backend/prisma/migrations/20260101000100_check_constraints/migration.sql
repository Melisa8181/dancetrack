-- Restricciones de integridad que Prisma no puede expresar en schema.prisma.
-- Prisma las ignora al comparar el esquema, por lo que no generan "drift".

ALTER TABLE "Training"
  ADD CONSTRAINT "Training_duration_check"  CHECK ("durationMinutes" > 0 AND "durationMinutes" <= 600),
  ADD CONSTRAINT "Training_intensity_check" CHECK ("intensity" BETWEEN 1 AND 10),
  ADD CONSTRAINT "Training_energy_check"    CHECK ("energyLevel" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Training_rest_check"      CHECK ("restHours" IS NULL OR ("restHours" >= 0 AND "restHours" <= 24));

ALTER TABLE "TeacherLink"
  ADD CONSTRAINT "TeacherLink_not_self_check" CHECK ("teacherId" <> "dancerId");
