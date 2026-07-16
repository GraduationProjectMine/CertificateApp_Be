import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('123456', 10);

  const org1 = await prisma.issuingOrganization.upsert({
    where: { contact_email: 'daihocbachkhoa@edu.vn' },
    update: {},
    create: {
      organization_id: 'org-bk-001',
      organization_name: 'Đại học Bách Khoa Hà Nội',
      contact_email: 'daihocbachkhoa@edu.vn',
      wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
      logo_url: 'https://example.com/logos/hust.png',
      is_verified: true,
    },
  });

  const org2 = await prisma.issuingOrganization.upsert({
    where: { contact_email: 'daihocquocgia@edu.vn' },
    update: {},
    create: {
      organization_id: 'org-vnu-002',
      organization_name: 'Đại học Quốc Gia Hà Nội',
      contact_email: 'daihocquocgia@edu.vn',
      wallet_address: '0xabcdef1234567890abcdef1234567890abcdef12',
      is_verified: true,
    },
  });

  const org3 = await prisma.issuingOrganization.upsert({
    where: { contact_email: 'daihocthuyloithuduc@edu.vn' },
    update: {},
    create: {
      organization_id: 'org-hcmut-003',
      organization_name: 'Trường Đại học Bách Khoa - ĐHQG TP.HCM',
      contact_email: 'daihocthuyloithuduc@edu.vn',
      wallet_address: '0x9876543210fedcba9876543210fedcba98765432',
      is_verified: false,
    },
  });

  const staff1 = await prisma.staffAccount.upsert({
    where: { email: 'tuyensinh@hust.edu.vn' },
    update: {
      name: 'Nguyễn Văn An',
      organization_id: org1.organization_id,
      organization_name: org1.organization_name,
      password: hashedPassword,
      role: 'STAFF',
      status: 'ACTIVE',
    },
    create: {
      staff_id: 'staff-hust-001',
      organization_id: org1.organization_id,
      name: 'Nguyễn Văn An',
      organization_name: org1.organization_name,
      email: 'tuyensinh@hust.edu.vn',
      password: hashedPassword,
      role: 'STAFF',
      status: 'ACTIVE',
    },
  });

  const staff2 = await prisma.staffAccount.upsert({
    where: { email: 'daotao@vnu.edu.vn' },
    update: {
      name: 'Trần Thị Bình',
      organization_id: org2.organization_id,
      organization_name: org2.organization_name,
      password: hashedPassword,
      role: 'STAFF',
      status: 'ACTIVE',
    },
    create: {
      staff_id: 'staff-vnu-002',
      organization_id: org2.organization_id,
      name: 'Trần Thị Bình',
      organization_name: org2.organization_name,
      email: 'daotao@vnu.edu.vn',
      password: hashedPassword,
      role: 'STAFF',
      status: 'ACTIVE',
    },
  });

  const staff3 = await prisma.staffAccount.upsert({
    where: { email: 'admin@hcmut.edu.vn' },
    update: {
      name: 'Lê Văn Cường',
      organization_id: org3.organization_id,
      organization_name: org3.organization_name,
      password: hashedPassword,
      role: 'ISSUER',
      status: 'ACTIVE',
    },
    create: {
      staff_id: 'staff-hcmut-003',
      organization_id: org3.organization_id,
      name: 'Lê Văn Cường',
      organization_name: org3.organization_name,
      email: 'admin@hcmut.edu.vn',
      password: hashedPassword,
      role: 'ISSUER',
      status: 'ACTIVE',
    },
  });

  const student1 = await prisma.studentAccount.upsert({
    where: { email: 'nguyenvandai@hust.edu.vn' },
    update: {},
    create: {
      student_id: 'stu-hust-001',
      organization_id: org1.organization_id,
      student_fullName: 'Nguyễn Văn Đại',
      organization_name: org1.organization_name,
      email: 'nguyenvandai@hust.edu.vn',
      password: hashedPassword,
      status: 'ACTIVE',
    },
  });

  const student2 = await prisma.studentAccount.upsert({
    where: { email: 'tranthimai@hust.edu.vn' },
    update: {},
    create: {
      student_id: 'stu-hust-002',
      organization_id: org1.organization_id,
      student_fullName: 'Trần Thị Mai',
      organization_name: org1.organization_name,
      email: 'tranthimai@hust.edu.vn',
      password: hashedPassword,
      status: 'ACTIVE',
    },
  });

  const student3 = await prisma.studentAccount.upsert({
    where: { email: 'phamvanhieu@vnu.edu.vn' },
    update: {},
    create: {
      student_id: 'stu-vnu-003',
      organization_id: org2.organization_id,
      student_fullName: 'Phạm Văn Hiếu',
      organization_name: org2.organization_name,
      email: 'phamvanhieu@vnu.edu.vn',
      password: hashedPassword,
      status: 'ACTIVE',
    },
  });

  const student4 = await prisma.studentAccount.upsert({
    where: { email: 'hoangthulan@vnu.edu.vn' },
    update: {},
    create: {
      student_id: 'stu-vnu-004',
      organization_id: org2.organization_id,
      student_fullName: 'Hoàng Thùy Lan',
      organization_name: org2.organization_name,
      email: 'hoangthulan@vnu.edu.vn',
      password: hashedPassword,
      status: 'ACTIVE',
    },
  });

  const student5 = await prisma.studentAccount.upsert({
    where: { email: 'dangminhtuan@hcmut.edu.vn' },
    update: {},
    create: {
      student_id: 'stu-hcmut-005',
      organization_id: org3.organization_id,
      student_fullName: 'Đặng Minh Tuấn',
      organization_name: org3.organization_name,
      email: 'dangminhtuan@hcmut.edu.vn',
      password: hashedPassword,
      status: 'ACTIVE',
    },
  });

  await prisma.certificate.upsert({
    where: { certificate_id: 'cert-hust-001' },
    update: {},
    create: {
      certificate_id: 'cert-hust-001',
      organization_id: org1.organization_id,
      student_id: student1.student_id,
      certificate_title: 'Bằng Kỹ sư Công nghệ Thông tin',
      organization_name: org1.organization_name,
      student_fullName: student1.student_fullName,
      dob: '15/08/2000',
      placeOfBirth: 'Hà Nội',
      gender: 'Nam',
      ethnicity: 'Kinh',
      schoolName: org1.organization_name,
      examCohort: '2018-2023',
      examBoard: 'Hội đồng thi Đại học Bách Khoa Hà Nội',
      issueLocation: 'Hà Nội',
      issueDate: '15/07/2023',
      serialNumber: 'BK-2023-IT-001',
      registryNumber: 'SO-2023-BK-001',
      ipfs_cid: 'QmXyZ123AbC456DeF789GhI012JkL345MnO678Pqr',
      tx_hash: '0xabc123def456ghi789jkl012mno345pqr678stu901vwx',
      status: 'ISSUED',
    },
  });

  await prisma.certificate.upsert({
    where: { certificate_id: 'cert-hust-002' },
    update: {},
    create: {
      certificate_id: 'cert-hust-002',
      organization_id: org1.organization_id,
      student_id: student2.student_id,
      certificate_title: 'Bằng Cử nhân Kế toán',
      organization_name: org1.organization_name,
      student_fullName: student2.student_fullName,
      dob: '22/11/2001',
      placeOfBirth: 'Nam Định',
      gender: 'Nữ',
      ethnicity: 'Kinh',
      schoolName: org1.organization_name,
      examCohort: '2019-2023',
      examBoard: 'Hội đồng thi Đại học Bách Khoa Hà Nội',
      issueLocation: 'Hà Nội',
      issueDate: '20/08/2023',
      serialNumber: 'BK-2023-KT-001',
      registryNumber: 'SO-2023-BK-002',
      ipfs_cid: 'QmAbC456DeF789GhI012JkL345MnO678Pqr901Stu',
      tx_hash: '0xdef456ghi789jkl012mno345pqr678stu901vwx234yza',
      status: 'ISSUED',
    },
  });

  await prisma.certificate.upsert({
    where: { certificate_id: 'cert-vnu-003' },
    update: {},
    create: {
      certificate_id: 'cert-vnu-003',
      organization_id: org2.organization_id,
      student_id: student3.student_id,
      certificate_title: 'Bằng Thạc sĩ Khoa học Máy tính',
      organization_name: org2.organization_name,
      student_fullName: student3.student_fullName,
      dob: '05/03/1998',
      placeOfBirth: 'Hải Phòng',
      gender: 'Nam',
      ethnicity: 'Kinh',
      schoolName: org2.organization_name,
      examCohort: '2021-2023',
      examBoard: 'Hội đồng thi Đại học Quốc Gia Hà Nội',
      issueLocation: 'Hà Nội',
      issueDate: '10/12/2023',
      serialNumber: 'VNU-2023-KHMT-001',
      registryNumber: 'SO-2023-VNU-001',
      ipfs_cid: 'QmDeF789GhI012JkL345MnO678Pqr901Stu234Vwx',
      tx_hash: '0xghi789jkl012mno345pqr678stu901vwx234yza567bcd',
      status: 'ISSUED',
    },
  });

  await prisma.certificate.upsert({
    where: { certificate_id: 'cert-vnu-004' },
    update: {},
    create: {
      certificate_id: 'cert-vnu-004',
      organization_id: org2.organization_id,
      student_id: student4.student_id,
      certificate_title: 'Bằng Cử nhân Ngôn ngữ Anh',
      organization_name: org2.organization_name,
      student_fullName: student4.student_fullName,
      dob: '18/07/2000',
      placeOfBirth: 'Thái Nguyên',
      gender: 'Nữ',
      ethnicity: 'Tày',
      schoolName: org2.organization_name,
      examCohort: '2018-2022',
      examBoard: 'Hội đồng thi Đại học Quốc Gia Hà Nội',
      issueLocation: 'Hà Nội',
      issueDate: '05/09/2022',
      serialNumber: 'VNU-2022-NNA-001',
      registryNumber: 'SO-2022-VNU-002',
      ipfs_cid: 'QmGhI012JkL345MnO678Pqr901Stu234Vwx567Yza',
      tx_hash: '0xjkl012mno345pqr678stu901vwx234yza567bcd890efg',
      status: 'ISSUED',
    },
  });

  await prisma.certificate.upsert({
    where: { certificate_id: 'cert-hcmut-005' },
    update: {},
    create: {
      certificate_id: 'cert-hcmut-005',
      organization_id: org3.organization_id,
      student_id: student5.student_id,
      certificate_title: 'Bằng Kỹ sư Kỹ thuật Điện',
      organization_name: org3.organization_name,
      student_fullName: student5.student_fullName,
      dob: '30/12/1999',
      placeOfBirth: 'TP. Hồ Chí Minh',
      gender: 'Nam',
      ethnicity: 'Kinh',
      schoolName: org3.organization_name,
      examCohort: '2017-2022',
      examBoard: 'Hội đồng thi Đại học Bách Khoa - ĐHQG TP.HCM',
      issueLocation: 'TP. Hồ Chí Minh',
      issueDate: '20/06/2022',
      serialNumber: 'HCMUT-2022-DIEN-001',
      registryNumber: 'SO-2022-HCMUT-001',
      ipfs_cid: 'QmJkL345MnO678Pqr901Stu234Vwx567Yza890Bcd',
      tx_hash: '0xmno345pqr678stu901vwx234yza567bcd890efg123hij',
      status: 'DRAFT',
    },
  });

  await prisma.certificate.upsert({
    where: { certificate_id: 'cert-hust-006' },
    update: {},
    create: {
      certificate_id: 'cert-hust-006',
      organization_id: org1.organization_id,
      student_id: student1.student_id,
      certificate_title: 'Chứng chỉ Tiếng Anh B1',
      organization_name: org1.organization_name,
      student_fullName: student1.student_fullName,
      dob: '15/08/2000',
      placeOfBirth: 'Hà Nội',
      gender: 'Nam',
      ethnicity: 'Kinh',
      schoolName: org1.organization_name,
      examCohort: '2023',
      examBoard: 'Trung tâm Khảo thí Đại học Bách Khoa Hà Nội',
      issueLocation: 'Hà Nội',
      issueDate: '10/01/2024',
      serialNumber: 'BK-2024-CC-001',
      registryNumber: 'SO-2024-BK-CC-001',
      ipfs_cid: 'QmPqr901Stu234Vwx567Yza890Bcd123Efg456Hij',
      status: 'PENDING',
    },
  });

  const defaultDesign = {
    page: { width: 800, height: 600, bgColor: '#ffffff' },
    fields: [
      { id: 'org_logo', type: 'image', x: 350, y: 40, w: 100, h: 100, dynamic: true, binding: 'organization_logo' },
      { id: 'org_name', type: 'text', x: 200, y: 150, w: 400, h: 30, font: 'serif', size: 14, color: '#666666', align: 'center', dynamic: true, binding: 'organization_name' },
      { id: 'title_label', type: 'text', x: 200, y: 200, w: 400, h: 20, font: 'serif', size: 11, color: '#999999', align: 'center', text: 'CHỨNG NHẬN' },
      { id: 'cert_title', type: 'text', x: 150, y: 230, w: 500, h: 60, font: 'serif', size: 28, color: '#1a1a1a', align: 'center', dynamic: true, binding: 'certificate_title', bold: true },
      { id: 'student_name', type: 'text', x: 200, y: 320, w: 400, h: 50, font: 'serif', size: 36, color: '#1a1a1a', align: 'center', dynamic: true, binding: 'student_fullName', bold: true },
      { id: 'dob', type: 'text', x: 200, y: 380, w: 400, h: 20, font: 'sans-serif', size: 12, color: '#555555', align: 'center', dynamic: true, binding: 'dob', label: 'Ngày sinh:' },
      { id: 'serial', type: 'text', x: 50, y: 520, w: 300, h: 20, font: 'sans-serif', size: 10, color: '#999999', align: 'left', dynamic: true, binding: 'serialNumber', label: 'Số hiệu:' },
      { id: 'issue_date', type: 'text', x: 450, y: 520, w: 300, h: 20, font: 'sans-serif', size: 10, color: '#999999', align: 'right', dynamic: true, binding: 'issueDate', label: 'Ngày cấp:' },
      { id: 'qr_code', type: 'qr', x: 650, y: 420, w: 80, h: 80, dynamic: true, binding: 'verification_url' },
    ],
    decorations: [
      { type: 'border', style: 'double', color: '#c9a84c', width: 4 },
      { type: 'border', style: 'single', color: '#e8dcc8', width: 1, offset: 10 },
    ],
  };

  const premiumDesign = {
    page: { width: 800, height: 600, bgColor: '#faf8f5' },
    fields: [
      { id: 'org_logo', type: 'image', x: 50, y: 40, w: 80, h: 80, dynamic: true, binding: 'organization_logo' },
      { id: 'org_name', type: 'text', x: 150, y: 55, w: 500, h: 25, font: 'sans-serif', size: 12, color: '#888888', align: 'left', dynamic: true, binding: 'organization_name' },
      { id: 'title_label', type: 'text', x: 200, y: 180, w: 400, h: 25, font: 'serif', size: 14, color: '#c9a84c', align: 'center', text: 'BẰNG TỐT NGHIỆP' },
      { id: 'cert_title', type: 'text', x: 150, y: 215, w: 500, h: 50, font: 'serif', size: 24, color: '#2d2d2d', align: 'center', dynamic: true, binding: 'certificate_title', bold: true },
      { id: 'student_name', type: 'text', x: 150, y: 310, w: 500, h: 55, font: 'script', size: 40, color: '#1a1a1a', align: 'center', dynamic: true, binding: 'student_fullName', bold: true },
      { id: 'achievement', type: 'text', x: 200, y: 370, w: 400, h: 20, font: 'sans-serif', size: 12, color: '#555555', align: 'center', text: 'đã hoàn thành chương trình đào tạo' },
      { id: 'dob_place', type: 'text', x: 200, y: 400, w: 400, h: 20, font: 'sans-serif', size: 11, color: '#777777', align: 'center', dynamic: true, binding: 'dob', label: 'Ngày sinh:' },
      { id: 'exam_board', type: 'text', x: 200, y: 420, w: 400, h: 20, font: 'sans-serif', size: 11, color: '#777777', align: 'center', dynamic: true, binding: 'examBoard' },
      { id: 'serial', type: 'text', x: 50, y: 520, w: 250, h: 20, font: 'sans-serif', size: 9, color: '#aaaaaa', align: 'left', dynamic: true, binding: 'serialNumber', label: 'Số hiệu:' },
      { id: 'registry', type: 'text', x: 300, y: 520, w: 250, h: 20, font: 'sans-serif', size: 9, color: '#aaaaaa', align: 'center', dynamic: true, binding: 'registryNumber', label: 'Số vào sổ:' },
      { id: 'issue_date', type: 'text', x: 550, y: 520, w: 200, h: 20, font: 'sans-serif', size: 9, color: '#aaaaaa', align: 'right', dynamic: true, binding: 'issueDate', label: 'Ngày cấp:' },
      { id: 'qr_code', type: 'qr', x: 650, y: 420, w: 90, h: 90, dynamic: true, binding: 'verification_url' },
    ],
    decorations: [
      { type: 'border', style: 'ornate', color: '#c9a84c', width: 6 },
      { type: 'watermark', text: 'VERIFIED', opacity: 0.04, font: 'serif', size: 60 },
    ],
  };

  await prisma.certificateTemplate.upsert({
    where: { id: 'tpl-hust-default-001' },
    update: { design_data: defaultDesign as any },
    create: {
      id: 'tpl-hust-default-001',
      organization_id: org1.organization_id,
      name: 'Mẫu bằng tốt nghiệp mặc định',
      description: 'Mẫu bằng tốt nghiệp tiêu chuẩn cho kỹ sư và cử nhân',
      design_data: defaultDesign as any,
      is_default: true,
    },
  });

  await prisma.certificateTemplate.upsert({
    where: { id: 'tpl-hust-premium-002' },
    update: { design_data: premiumDesign as any },
    create: {
      id: 'tpl-hust-premium-002',
      organization_id: org1.organization_id,
      name: 'Mẫu bằng tốt nghiệp cao cấp',
      description: 'Mẫu bằng cao cấp với thiết kế sang trọng, phù hợp cho bằng thạc sĩ',
      design_data: premiumDesign as any,
      is_default: false,
    },
  });

  await prisma.certificateTemplate.upsert({
    where: { id: 'tpl-vnu-default-003' },
    update: { design_data: defaultDesign as any },
    create: {
      id: 'tpl-vnu-default-003',
      organization_id: org2.organization_id,
      name: 'Mẫu bằng mặc định',
      description: 'Mẫu bằng tiêu chuẩn cho Đại học Quốc Gia',
      design_data: defaultDesign as any,
      is_default: true,
    },
  });

  await prisma.certificateTemplate.upsert({
    where: { id: 'tpl-hcmut-default-004' },
    update: { design_data: premiumDesign as any },
    create: {
      id: 'tpl-hcmut-default-004',
      organization_id: org3.organization_id,
      name: 'Mẫu bằng cao cấp',
      description: 'Mẫu bằng cao cấp cho kỹ sư',
      design_data: premiumDesign as any,
      is_default: true,
    },
  });

  console.log('Seeding completed successfully!');
  console.log('--- Sample Accounts (password: 123456) ---');
  console.log('Staff 1: tuyensinh@hust.edu.vn');
  console.log('Staff 2: daotao@vnu.edu.vn');
  console.log('Staff 3: admin@hcmut.edu.vn');
  console.log('Student 1: nguyenvandai@hust.edu.vn');
  console.log('Student 2: tranthimai@hust.edu.vn');
  console.log('Student 3: phamvanhieu@vnu.edu.vn');
  console.log('Student 4: hoangthulan@vnu.edu.vn');
  console.log('Student 5: dangminhtuan@hcmut.edu.vn');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
