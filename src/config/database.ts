import { PrismaClient } from "@prisma/client";
import "./databaseUrl";

const prisma = new PrismaClient();

export default prisma;
