import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/settings
// Fetch all system settings as a unified object
router.get('/', authenticate, async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    
    // Convert array of key-value records to a single object
    const result: Record<string, any> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings
// Update system settings. Accepts an object where keys are setting keys and values are JSON objects
router.put('/', authenticate, requireModule('settings'), async (req, res) => {
  try {
    const updates = req.body;
    if (typeof updates !== 'object' || updates === null) {
      return res.status(400).json({ error: 'Invalid payload. Expected JSON object.' });
    }

    // Upsert each key in the payload
    const transactions = Object.entries(updates).map(([key, value]) => {
      // Prisma expects a valid JSON string or object for Json fields
      return prisma.systemSetting.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      });
    });

    await prisma.$transaction(transactions);

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
