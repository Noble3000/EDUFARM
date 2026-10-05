import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const orders = await prisma.paymentOrder.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
console.log(JSON.stringify(orders.map((o) => ({ id: o.id.slice(0, 8), status: o.status, provider: o.provider, providerRef: o.providerRef, key: o.idempotencyKey })), null, 1));
await prisma.$disconnect();
