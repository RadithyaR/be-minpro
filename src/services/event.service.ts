import { Event, Prisma, User } from "@prisma/client";
import prisma from "../lib/prisma";

export default class EventService {
  async createEvent(event: Event) {
    await prisma.event.create({
      data: event,
    });
  }
}
