-- Add pickupNotifiedAt to Appointment for tracking last notification time
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "pickupNotifiedAt" TIMESTAMP(3);
