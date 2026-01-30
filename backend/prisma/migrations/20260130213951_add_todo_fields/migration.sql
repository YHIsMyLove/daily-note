-- AlterTable to add todo-specific fields to ClaudeTask model
ALTER TABLE `ClaudeTask` ADD COLUMN `title` TEXT;
ALTER TABLE `ClaudeTask` ADD COLUMN `description` TEXT;
ALTER TABLE `ClaudeTask` ADD COLUMN `dueDate` DATETIME;
ALTER TABLE `ClaudeTask` ADD COLUMN `todoCompletedAt` DATETIME;
ALTER TABLE `ClaudeTask` ADD COLUMN `isAiGenerated` BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE `ClaudeTask` ADD COLUMN `autoCompletionEnabled` BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE `ClaudeTask` ADD COLUMN `autoCompletionTaskId` TEXT;
ALTER TABLE `ClaudeTask` ADD COLUMN `autoCompletionError` TEXT;
ALTER TABLE `ClaudeTask` ADD COLUMN `todoMetadata` TEXT;

-- Create indexes for efficient querying
CREATE INDEX `ClaudeTask_isAiGenerated_idx` ON `ClaudeTask`(`isAiGenerated`);
CREATE INDEX `ClaudeTask_autoCompletionEnabled_idx` ON `ClaudeTask`(`autoCompletionEnabled`);
CREATE INDEX `ClaudeTask_dueDate_idx` ON `ClaudeTask`(`dueDate`);
