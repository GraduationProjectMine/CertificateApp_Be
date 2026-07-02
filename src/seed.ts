import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    await prisma.certificate.deleteMany();
    await prisma.studentAccount.deleteMany();
    await prisma.staffAccount.deleteMany();
    await prisma.issuingOrganization.deleteMany();
  } catch (err) {
    console.log('Note: Could not clear tables, they might not exist yet.');
  }

  const SALT_ROUNDS = 10;
  const adminPasswordHash = await bcrypt.hash('Admin123', SALT_ROUNDS);
  const staffPasswordHash = await bcrypt.hash('Staff123', SALT_ROUNDS);
  const studentPasswordHash = await bcrypt.hash('Student123', SALT_ROUNDS);

  // 1. Create Issuing Organization
  const org = await prisma.issuingOrganization.create({
    data: {
      organization_name: 'Trường Đại học Blockchain Việt Nam',
      contact_email: 'contact@blockchain.edu.vn',
      wallet_address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Account #0
      is_verified: true,
    },
  });
  console.log('✅ Created Organization:', org.organization_name);

  // 2. Create Staff Accounts
  const adminStaff = await prisma.staffAccount.create({
    data: {
      organization_id: org.organization_id,
      name: 'Admin Trường',
      organization_name: org.organization_name,
      email: 'admin@school.edu.vn',
      password: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created Admin Staff:', adminStaff.email);

  const regularStaff = await prisma.staffAccount.create({
    data: {
      organization_id: org.organization_id,
      name: 'Nhân viên Cấp bằng',
      organization_name: org.organization_name,
      email: 'staff@school.edu.vn',
      password: staffPasswordHash,
      role: 'Staff',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created Regular Staff:', regularStaff.email);

  // 3. Create Student Account
  const student = await prisma.studentAccount.create({
    data: {
      organization_id: org.organization_id,
      student_fullName: 'Nguyễn Văn Sinh Viên',
      organization_name: org.organization_name,
      email: 'student@school.edu.vn',
      password: studentPasswordHash,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created Student:', student.email);

  console.log('🏁 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
