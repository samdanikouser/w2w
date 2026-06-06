import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  await prisma.trainingModule.createMany({
    data: [
      { name: 'Health and Safety Induction', description: 'Basic OHS for all site workers', type: 'MANDATORY', durationHrs: 2 },
      { name: 'Waste Sorting Basics', description: 'How to properly identify and sort recyclables', type: 'MANDATORY', durationHrs: 4 },
      { name: 'Equipment Operation', description: 'Operating balers and scales safely', type: 'OPTIONAL', durationHrs: 8 },
      { name: 'First Aid Training', description: 'Basic first aid response', type: 'OPTIONAL', durationHrs: 16 }
    ]
  });
  console.log("Training modules seeded.");
}
run();
