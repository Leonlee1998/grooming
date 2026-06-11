import { prismaAdmin } from '@repo/db'

export function getStoreId(): string {
  return process.env.STORE_ID ?? 'default-store'
}

export async function getStoreIdFromCustomer(
  customerId: string,
): Promise<string> {
  const customer = await prismaAdmin.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { storeId: true },
  })
  return customer.storeId
}
