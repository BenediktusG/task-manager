-- AlterTable
ALTER TABLE `JoinRequest` ADD COLUMN `handlerUserId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `JoinRequest` ADD CONSTRAINT `JoinRequest_handlerUserId_fkey` FOREIGN KEY (`handlerUserId`) REFERENCES `User`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
