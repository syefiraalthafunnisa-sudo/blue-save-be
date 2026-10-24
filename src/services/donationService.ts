import { randomUUID } from "crypto";
import { createDonation } from "../repositories/donationRepository";

export const createTransaction = async (
  amount: number,
  userId: string
) => {
  const donation = await createDonation({
    orderId: `ORDER-${randomUUID()}`,
    amount,
    userId,
  });

  return {
    id: donation.id,
    orderId: donation.orderId,
    amount: Number(donation.amount),
    status: "success",
    dummy: true,
  };
};
