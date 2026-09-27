// Better Auth server config — single backend for all three portals.
// Portals: web-student :3001, web-lecturer :3002, web-admin :3003 → API :4000.
// Role enforced at middleware: student vs lecturer are separate login routes, never role-switched.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  plugins: [
    twoFactor(), // required for deptAdmin/institutionAdmin/platformAdmin
  ],
  user: {
    additionalFields: {
      role: { type: "string", required: true },
      phone: { type: "string", required: false },
    },
  },
  trustedOrigins: [
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ],
});
