-- AlterTable: archived announcements stay in DB but leave student feeds (§9.1)
ALTER TABLE "Announcement" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
