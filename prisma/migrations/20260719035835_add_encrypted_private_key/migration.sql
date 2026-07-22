-- CreateTable
CREATE TABLE `issuing_organization` (
    `organization_id` VARCHAR(191) NOT NULL,
    `wallet_address` VARCHAR(191) NULL,
    `encrypted_private_key` VARCHAR(191) NULL,
    `organization_name` VARCHAR(191) NOT NULL,
    `contact_email` VARCHAR(191) NOT NULL,
    `logo_url` VARCHAR(191) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `issuing_organization_wallet_address_key`(`wallet_address`),
    UNIQUE INDEX `issuing_organization_contact_email_key`(`contact_email`),
    PRIMARY KEY (`organization_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `super_admins` (
    `admin_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `super_admins_email_key`(`email`),
    PRIMARY KEY (`admin_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_accounts` (
    `staff_id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `organization_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'STAFF',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `staff_accounts_email_key`(`email`),
    INDEX `staff_accounts_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`staff_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_accounts` (
    `student_id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `student_fullName` VARCHAR(191) NOT NULL,
    `organization_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_accounts_email_key`(`email`),
    INDEX `student_accounts_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_templates` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `design_data` JSON NOT NULL,
    `thumbnail_url` VARCHAR(191) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `certificate_templates_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate` (
    `certificate_id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NULL,
    `certificate_title` VARCHAR(191) NOT NULL,
    `organization_name` VARCHAR(191) NOT NULL,
    `student_fullName` VARCHAR(191) NOT NULL,
    `dob` VARCHAR(191) NULL,
    `placeOfBirth` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `ethnicity` VARCHAR(191) NULL,
    `schoolName` VARCHAR(191) NULL,
    `examCohort` VARCHAR(191) NULL,
    `examBoard` VARCHAR(191) NULL,
    `issueLocation` VARCHAR(191) NULL,
    `issueDate` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `registryNumber` VARCHAR(191) NULL,
    `ipfs_cid` VARCHAR(191) NULL,
    `tx_hash` VARCHAR(191) NULL,
    `block_number` INTEGER NULL,
    `gas_used` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `revokedById` VARCHAR(191) NULL,
    `revokeReason` VARCHAR(500) NULL,
    `revoke_tx_hash` VARCHAR(191) NULL,
    `revoke_block_number` INTEGER NULL,

    INDEX `certificate_organization_id_idx`(`organization_id`),
    INDEX `certificate_student_id_idx`(`student_id`),
    INDEX `certificate_template_id_idx`(`template_id`),
    INDEX `certificate_status_revokedAt_idx`(`status`, `revokedAt`),
    INDEX `certificate_revokedById_idx`(`revokedById`),
    PRIMARY KEY (`certificate_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issuance_batches` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PROCESSING',
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `successRows` INTEGER NOT NULL DEFAULT 0,
    `failedRows` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NOT NULL,
    `createdByName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `issuance_batches_organization_id_createdAt_idx`(`organization_id`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issuance_batch_items` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `input` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `error` TEXT NULL,
    `certificateId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `issuance_batch_items_batchId_status_idx`(`batchId`, `status`),
    UNIQUE INDEX `issuance_batch_items_batchId_rowNumber_key`(`batchId`, `rowNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(500) NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organization_id_createdAt_idx`(`organization_id`, `createdAt`),
    INDEX `audit_logs_actorId_idx`(`actorId`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_targetId_idx`(`targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `issuing_organization`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_accounts` ADD CONSTRAINT `student_accounts_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `issuing_organization`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate_templates` ADD CONSTRAINT `certificate_templates_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `issuing_organization`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate` ADD CONSTRAINT `certificate_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `issuing_organization`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate` ADD CONSTRAINT `certificate_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `student_accounts`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate` ADD CONSTRAINT `certificate_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `certificate_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issuance_batches` ADD CONSTRAINT `issuance_batches_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `issuing_organization`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issuance_batch_items` ADD CONSTRAINT `issuance_batch_items_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `issuance_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `issuing_organization`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
