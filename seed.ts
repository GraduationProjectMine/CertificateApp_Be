import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('✅ Bắt đầu kết nối database qua Prisma để seed dữ liệu...');

    // Xóa dữ liệu cũ
    await prisma.verificationLog.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.certificate.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.institution.deleteMany({});

    console.log(`🧹 Đã dọn dẹp dữ liệu cũ.`);

    const salt = await bcrypt.genSalt(10);
    const superAdminPasswordHash = await bcrypt.hash('superadmin123', salt);
    const adminPasswordHash = await bcrypt.hash('admin123', salt);
    const studentPasswordHash = await bcrypt.hash('student123', salt);

    // 1. Tạo Super Admin
    const superAdmin = await prisma.user.create({
      data: {
        email: 'superadmin@university.edu',
        password: superAdminPasswordHash,
        name: 'Hệ thống Quản lý',
        role: 'super_admin',
        walletAddress: null
      }
    });
    console.log(`✅ Đã tạo tài khoản Super Admin: ${superAdmin.email} / superadmin123`);

    // 2. Tạo Institution mặc định (VNU-BC)
    const institution = await prisma.institution.create({
      data: {
        name: 'Trường Đại học Blockchain Việt Nam',
        code: 'VNU-BC',
        contractAddress: '0x0000000000000000000000000000000000000001', // Mock address to prevent conflicts with dynamic deployments (e.g. 0x5FbDB2315678afecb367f032d93F642f64180aa3)
        chainId: Number(process.env.CHAIN_ID || 31337),
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Đã tạo Institution mặc định: ${institution.name} (${institution.code})`);

    // 3. Tạo Institution Admin
    const admin = await prisma.user.create({
      data: {
        email: 'admin@university.edu',
        password: adminPasswordHash,
        name: 'Phòng Đào Tạo VNU-BC',
        role: 'institution_admin',
        institutionId: institution.id,
        walletAddress: null
      }
    });
    console.log(`✅ Đã tạo tài khoản Institution Admin: ${admin.email} / admin123`);

    // 4. Tạo Sinh viên
    const student = await prisma.user.create({
      data: {
        email: 'student@university.edu',
        password: studentPasswordHash,
        name: 'Nguyễn Văn A',
        studentId: 'SV2024001',
        role: 'student',
        institutionId: institution.id,
        walletAddress: null
      }
    });
    console.log(`✅ Đã tạo tài khoản Sinh viên: ${student.email} / student123 (MSSV: ${student.studentId})`);

    console.log('\n🎉 Quá trình seed dữ liệu thành công!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi seed dữ liệu:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
