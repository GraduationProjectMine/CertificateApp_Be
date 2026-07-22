import { PrismaClient } from './src/generated/prisma/client';
import { ethers } from 'ethers';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3000';

async function fetchApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`API Error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  const testEmail = `test.org.${Date.now()}@example.com`;
  
  console.log(`\n--- BƯỚC 1: Đăng ký tổ chức mới (${testEmail}) ---`);
  const registerRes = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      name: 'Trường Đại học TestFlow',
      password: 'Password123!',
      adminName: 'Admin TestFlow'
    })
  });
  const staffAcc = await prisma.staffAccount.findUnique({
    where: { staff_id: registerRes.id }
  });
  const orgId = staffAcc!.organization_id;
  console.log('✅ Đăng ký thành công, staff ID:', registerRes.id, '| Org ID:', orgId);
  const newOrgStaffToken = registerRes.accessToken;

  console.log(`\n--- BƯỚC 2: Admin duyệt tổ chức ---`);
  // Login super admin
  const adminLogin = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@certichain.vn', password: '123456' })
  });
  const adminToken = adminLogin.accessToken;
  console.log('✅ Admin login thành công');

  // Approve org
  await fetchApi(`/super-admin/organizations/${orgId}/verify`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('✅ Admin đã duyệt tổ chức');

  console.log(`\n--- BƯỚC 3: Kiểm tra tài khoản đã có privatekey chưa ---`);
  const orgInDb = await prisma.issuingOrganization.findUnique({
    where: { organization_id: orgId }
  });
  if (orgInDb && orgInDb.encrypted_private_key) {
    console.log('✅ Tổ chức đã được tạo ví với địa chỉ:', orgInDb.wallet_address);
    console.log('✅ Encrypted Private Key tồn tại (đã che):', orgInDb.encrypted_private_key.substring(0, 15) + '...');
    
    // Fund wallet
    console.log('Đang nạp ETH vào ví của tổ chức để trả phí gas...');
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY!, provider);
    const tx = await adminWallet.sendTransaction({
      to: orgInDb.wallet_address!,
      value: ethers.parseEther('1.0')
    });
    await tx.wait();
    console.log('✅ Đã nạp 1.0 ETH thành công, hash:', tx.hash);
  } else {
    console.error('❌ Không tìm thấy Private Key cho tổ chức!');
  }

  console.log(`\n--- BƯỚC 4: Đưa 1 văn bằng lên IPFS & Blockchain ---`);
  // Cần funding ETH cho tổ chức mới nếu hệ thống yêu cầu phí gas từ ví của tổ chức
  // Tuy nhiên, logic backend có thể có hàm fundOrgWallet (vừa xem trong code). 
  // Việc cấp phát chứng chỉ có thể thực hiện bởi ví admin hoặc ví của tổ chức. 
  
  // 4a. Create Draft
  console.log('Đang tạo bản nháp văn bằng...');
  const studentEmail = `student.${Date.now()}@example.com`;
  // Create a student first so we have a valid student_id
  const studentAccount = await prisma.studentAccount.create({
    data: {
      organization_id: orgId,
      organization_name: 'Trường Đại học TestFlow',
      student_fullName: 'Sinh Viên Test',
      email: studentEmail,
      password: 'Password123!'
    }
  });

  const draftRes = await fetchApi('/certificates/draft', {
    method: 'POST',
    headers: { Authorization: `Bearer ${newOrgStaffToken}` },
    body: JSON.stringify({
      student_id: studentAccount.student_id,
      certificate_title: 'Bằng Cử nhân TestFlow',
      dob: '01/01/2000',
      placeOfBirth: 'Hà Nội',
      gender: 'Nam',
      ethnicity: 'Kinh',
      schoolName: 'Trường Đại học TestFlow',
      examCohort: '2020-2024',
      examBoard: 'Hội đồng Test',
      issueLocation: 'Hà Nội',
      issueDate: '20/07/2026',
      serialNumber: `TEST-SN-${Date.now()}`,
      registryNumber: `TEST-RN-${Date.now()}`
    })
  });
  const certId = draftRes.certificate_id;
  console.log('✅ Đã tạo bản nháp thành công, Certificate ID:', certId);

  // Submit to PENDING
  await fetchApi(`/certificates/${certId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${newOrgStaffToken}` },
    body: JSON.stringify({ status: 'PENDING' })
  });
  console.log('✅ Đã chuyển trạng thái sang PENDING');

  // 4b. Approve (Issue to IPFS and Blockchain)
  console.log('Đang phát hành văn bằng (lên IPFS & Blockchain). Quá trình này có thể mất vài giây...');
  const approveRes = await fetchApi(`/certificates/${certId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${newOrgStaffToken}` }
  });
  
  console.log('✅ Phát hành văn bằng thành công!');
  console.log('   - CID trên IPFS:', approveRes.ipfs_cid);
  console.log('   - Transaction Hash:', approveRes.tx_hash);
  console.log('   - Block Number:', approveRes.block_number);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Có lỗi xảy ra trong quá trình test:');
  console.error(e.message);
  process.exit(1);
});
