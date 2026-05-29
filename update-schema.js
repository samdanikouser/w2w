const fs = require('fs');
let schema = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');

// Add Depot and Cooperative models
const newModels = `
model Depot {
  id                String   @id @default(uuid())
  name              String
  regionCode        String   @default("A")
  managerUserId     String?
  totalFleetCount   Int      @default(0)
  operatingBudget   Float    @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  sites             Site[]

  @@map("depots")
}

model Cooperative {
  id                    String   @id @default(uuid())
  siteId                String
  name                  String
  registrationNumber    String   @default("")
  contactNumber         String   @default("")
  totalMembers          Int      @default(0)
  materialPayoutRates   Json?
  dailyTonsRecovered    Float    @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  site                  Site     @relation(fields: [siteId], references: [id])

  @@map("cooperatives")
}
`;

if (!schema.includes('model Depot {')) {
  schema += newModels;
}

// Modify Site model
// We need to add depotId and cooperatives
if (!schema.includes('depotId')) {
  schema = schema.replace(
    '  employees      Employee[]',
    `  depotId        String?\n  depot          Depot?      @relation(fields: [depotId], references: [id])\n  cooperatives   Cooperative[]\n  employees      Employee[]`
  );
}

fs.writeFileSync('backend/prisma/schema.prisma', schema);
console.log('Schema updated');
