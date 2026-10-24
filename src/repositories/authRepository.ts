import prisma from "../config/database";

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({ where: { email } });
};

export const createUser = async (data: any) => {
  return await prisma.user.create({ data });
};

export const addRefreshToken = async (userId: string, token: string) => {
  return await prisma.refreshToken.create({
    data: {
      token,
      userId,
    },
  });
};

export const removeRefreshToken = async (token: string) => {
  return await prisma.refreshToken.deleteMany({
    where: { token },
  });
};

export const rotateRefreshToken = async (
  userId: string,
  oldToken: string,
  newToken: string
) => {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.refreshToken.deleteMany({
      where: { token: oldToken, userId },
    });
    if (removed.count === 0) return false;
    await tx.refreshToken.create({ data: { userId, token: newToken } });
    return true;
  });
};

export const findUserByRefreshToken = async (refreshToken: string) => {
  const refreshTokenRecord = await prisma.refreshToken.findFirst({
    where: { token: refreshToken },
    include: { user: true },
  });
  return refreshTokenRecord?.user || null;
};

export const getUserRefreshTokens = async (userId: string) => {
  return await prisma.refreshToken.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
};
