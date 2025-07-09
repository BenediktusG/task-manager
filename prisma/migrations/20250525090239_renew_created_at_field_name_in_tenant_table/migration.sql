/*
  Warnings:

  - You are about to drop the column `dateTime` on the `Tenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Tenant` DROP COLUMN `dateTime`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
