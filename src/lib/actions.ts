"use server";

import { destroySession } from "./session";

export async function disconnectDrive() {
  await destroySession();
}