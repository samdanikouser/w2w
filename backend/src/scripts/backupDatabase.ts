import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables (useful if running locally/manually)
dotenv.config();

const {
  DATABASE_URL,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  BACKUP_EMAIL_TO,
} = process.env;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL is missing.");
  process.exit(1);
}

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !BACKUP_EMAIL_TO) {
  console.error("❌ ERROR: Missing Email credentials. Ensure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and BACKUP_EMAIL_TO are set.");
  process.exit(1);
}

// 1. Configure the Email Transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// 2. Generate a secure, unique filename for the backup
const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `w2w-db-backup-${dateStr}.sql.gz`;
const backupPath = path.join('/tmp', backupFilename);

console.log(`⏳ Starting database backup...`);
console.log(`📦 Temp file will be created at: ${backupPath}`);

// 3. Execute pg_dump, compress it with gzip, and save to /tmp
// Note: This requires 'postgresql-client' to be installed on the machine running this script.
const pgDumpCommand = `pg_dump "${DATABASE_URL}" | gzip > ${backupPath}`;

exec(pgDumpCommand, async (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ ERROR generating database dump: ${error.message}`);
    process.exit(1);
  }

  if (stderr) {
    // pg_dump writes some non-fatal warnings to stderr, we log them but continue
    console.warn(`⚠️ Warning from pg_dump: ${stderr}`);
  }

  console.log(`✅ Database dump created and compressed successfully!`);
  console.log(`⏳ Sending backup via email to: ${BACKUP_EMAIL_TO}...`);

  try {
    const stats = fs.statSync(backupPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    // 4. Send the email with the backup file attached
    await transporter.sendMail({
      from: `"W2W Backup System" <${SMTP_USER}>`,
      to: BACKUP_EMAIL_TO,
      subject: `🛡️ Automated Database Backup - ${new Date().toLocaleDateString()}`,
      text: `Hello,\n\nPlease find the automated database backup attached.\n\nFile: ${backupFilename}\nSize: ${fileSizeInMB} MB\nGenerated At: ${new Date().toUTCString()}\n\nKeep this file secure.\n\n- W2W System`,
      attachments: [
        {
          filename: backupFilename,
          path: backupPath,
          contentType: 'application/gzip',
        },
      ],
    });

    console.log(`✅ Backup successfully emailed to ${BACKUP_EMAIL_TO}!`);

    // 5. Clean up the temp file
    fs.unlinkSync(backupPath);
    console.log(`🧹 Cleaned up temporary file: ${backupPath}`);
    console.log(`🎉 Backup process complete!`);
    
  } catch (err) {
    console.error(`❌ ERROR sending email:`, err);
    process.exit(1);
  }
});
