import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

import { customers } from './seeds/customers';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed known credentials into production');
  }

  for (const { password, ...customer } of customers) {
    const hashed = await argon2.hash(password);
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: { password: hashed },
      create: { ...customer, password: hashed },
    });
  }

  console.log(`Seeded ${customers.length} customers`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
