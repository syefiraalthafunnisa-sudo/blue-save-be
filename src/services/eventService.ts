import {
  findAllEvents,
  findEventById,
  createEventRegistration,
} from "../repositories/eventRepository";
import HttpError from "../utils/HttpError";
import { Prisma } from "@prisma/client";

export const fetchAllEvents = async (page: number, limit: number) => {
  return await findAllEvents(page, limit);
};

export const fetchEventById = async (eventId: string) => {
  const event = await findEventById(eventId);
  if (!event) {
    throw new HttpError("Event not found", 404);
  }

  return event;
};

export const registerUserToEvent = async (userId: string, eventId: string) => {
  await fetchEventById(eventId);
  try {
    return await createEventRegistration(userId, eventId);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        throw new HttpError("Already registered for this event", 409);
      }
      if (err.code === "P2003") {
        throw new HttpError("Event or user no longer exists", 404);
      }
    }
    throw err;
  }
};
