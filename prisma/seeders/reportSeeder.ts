import { ReportStatus } from "../../src/types";
import prisma from "../../src/config/database";

async function main() {
  const reports = [
    {
      title: "Ocean Trash",
      street: "Jalan Ahmad Yani",
      province: "East Java",
      country: "Indonesia",
      description: "Ocean Trash Trash Trash",
      media: "/images/placeholder.svg",
      status: ReportStatus.WAITING,
      userId: "8a01f8cb-3598-469b-9c70-cc68b4d75c11",
    },
    {
      title: "Ocean Trash",
      street: "Jalan Ahmad Yani",
      province: "East Java",
      country: "Indonesia",
      description: "Ocean Trash Trash Trash",
      media: "/images/placeholder.svg",
      status: ReportStatus.VERIFIED,
      userId: "8a01f8cb-3598-469b-9c70-cc68b4d75c11",
    },
    {
      title: "Ocean Trash",
      street: "Jalan Ahmad Yani",
      province: "East Java",
      country: "Indonesia",
      description: "Ocean Trash Trash Trash",
      media: "/images/placeholder.svg",
      status: ReportStatus.INVALID,
      userId: "8a01f8cb-3598-469b-9c70-cc68b4d75c11",
    },
    {
      title: "Ocean Trash",
      street: "Jalan Ahmad Yani",
      province: "East Java",
      country: "Indonesia",
      description: "Ocean Trash Trash Trash",
      media: "/images/placeholder.svg",
      status: ReportStatus.RESOLVED,
      userId: "8a01f8cb-3598-469b-9c70-cc68b4d75c11",
    },
  ];

  for (const report of reports) {
    await prisma.report.create({
      data: report,
    });
  }

  console.log("Reports seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
