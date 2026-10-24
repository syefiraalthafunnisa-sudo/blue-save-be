import cron from "node-cron";
import prisma from "../config/database";
import { ReportStatus } from "../types";

cron.schedule("0 * * * *", async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const updatedReports = await prisma.report.updateMany({
      where: {
        status: ReportStatus.WAITING,
        createdAt: { lt: twentyFourHoursAgo },
      },
      data: { status: ReportStatus.VERIFIED },
    });

    console.log(`Verified ${updatedReports.count} reports.`);
  } catch (err) {
    console.error("Failed to verify reports:", err);
  }
});

console.log("Scheduled job to verify reports is running...");
