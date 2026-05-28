const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const types = [
    { name: 'PET Plastic (Clear)', category: 'Plastics', unit: 'kg', pricePerUnit: 0, colour: '#146484' },
    { name: 'HDPE Plastic', category: 'Plastics', unit: 'kg', pricePerUnit: 0, colour: '#4CAF50' },
    { name: 'LDPE Plastic', category: 'Plastics', unit: 'kg', pricePerUnit: 0, colour: '#00BCD4' },
    { name: 'PP Plastic', category: 'Plastics', unit: 'kg', pricePerUnit: 0, colour: '#FF9800' },
    { name: 'Metal / Scrap', category: 'Metals', unit: 'kg', pricePerUnit: 0, colour: '#607D8B' },
    { name: 'Paper', category: 'Paper', unit: 'kg', pricePerUnit: 0, colour: '#795548' },
    { name: 'Cardboard', category: 'Paper', unit: 'kg', pricePerUnit: 0, colour: '#8D6E63' },
    { name: 'Glass', category: 'Glass', unit: 'kg', pricePerUnit: 0, colour: '#9E9E9E' },
    { name: 'E-Waste', category: 'E-Waste', unit: 'kg', pricePerUnit: 0, colour: '#E91E63' },
    { name: 'Other / Mixed', category: 'Other', unit: 'kg', pricePerUnit: 0, colour: '#9C27B0' },
  ];

  for (const t of types) {
    await prisma.wasteType.create({ data: t });
  }
  console.log('Done!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
