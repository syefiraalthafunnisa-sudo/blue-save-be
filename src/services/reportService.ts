import { unlink } from "fs/promises";
import {
  createReport,
  findReportsByUserId,
} from "../repositories/reportRepository";
import HttpError from "../utils/HttpError";
import { formatDateWithoutYear } from "../utils/date";

export const createNewReport = async (
  title: string,
  street: string,
  province: string,
  country: string,
  description: string,
  file: Express.Multer.File,
  userId: string
) => {
  if (!file) {
    throw new HttpError("File is required", 400);
  }

  try {
    const report = await createReport({
      title,
      street,
      province,
      country,
      description,
      media: `/uploads/reports/${file.filename}`,
      userId,
    });

    return {
      ...report,
      createdAt: formatDateWithoutYear(new Date(report.createdAt)),
    };
  } catch (err) {
    await unlink(file.path).catch(() => undefined);
    throw err;
  }
};

export const fetchReportsByUserId = async (userId: string) => {
  const reports = await findReportsByUserId(userId);
  return reports.map((report: any) => ({
    ...report,
    createdAt: formatDateWithoutYear(new Date(report.createdAt)),
  }));
};
