import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const SALT_ROUNDS = 12;

function parseCsv(text: string): { name: string; email: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2)
    throw new BadRequestException(
      'File CSV phải có header và ít nhất 1 dòng dữ liệu',
    );

  const header = lines[0].toLowerCase().replace(/["']/g, '');
  const cols = header.split(',').map((c) => c.trim());
  const nameIdx = cols.findIndex(
    (c) =>
      c === 'name' ||
      c === 'fullname' ||
      c === 'tên' ||
      c === 'ten' ||
      c === 'họ tên' ||
      c === 'ho ten',
  );
  const emailIdx = cols.findIndex(
    (c) =>
      c === 'email' ||
      c === 'e-mail' ||
      c === 'thư điện tử' ||
      c === 'thu dien tu',
  );

  if (nameIdx === -1)
    throw new BadRequestException(
      'Không tìm thấy cột "name" hoặc "fullname" trong file CSV',
    );
  if (emailIdx === -1)
    throw new BadRequestException('Không tìm thấy cột "email" trong file CSV');

  const rows: { name: string; email: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i]
      .split(',')
      .map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const name = vals[nameIdx]?.trim();
    const email = vals[emailIdx]?.trim();
    if (!name && !email) continue;
    rows.push({ name: name || '', email: email || '' });
  }

  return rows;
}

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    student_fullName: string,
    email: string,
    hashedPassword: string,
    organization_id: string,
    organization_name?: string,
    import_batch_id?: string,
    imported_by?: string,
  ) {
    let orgName = organization_name;
    if (!orgName) {
      const org = await this.prisma.issuingOrganization.findUnique({
        where: { organization_id },
      });
      orgName = org?.organization_name ?? '';
    }

    return this.prisma.studentAccount.create({
      data: {
        student_fullName,
        email,
        password: hashedPassword,
        organization_id,
        organization_name: orgName,
        import_batch_id,
        imported_by,
      },
    });
  }

  async importFromCsv(
    fileBuffer: Buffer,
    fileName: string,
    organization_id: string,
    organization_name: string,
    userId: string,
    userName: string,
  ) {
    const text = fileBuffer.toString('utf-8');
    const rows = parseCsv(text);

    if (rows.length === 0) {
      throw new BadRequestException('File CSV không có dữ liệu hợp lệ');
    }

    const batch = await this.prisma.studentImportBatch.create({
      data: {
        organization_id,
        created_by_id: userId,
        created_by_name: userName,
        file_name: fileName,
        total_rows: rows.length,
      },
    });

    const results: {
      row: number;
      name: string;
      email: string;
      status: string;
      error?: string;
      student_id?: string;
      password?: string;
    }[] = [];
    let success = 0;
    let failed = 0;

    const existingEmails = await this.prisma.studentAccount.findMany({
      where: { organization_id },
      select: { email: true },
    });
    const emailSet = new Set(existingEmails.map((e) => e.email.toLowerCase()));

    for (let i = 0; i < rows.length; i++) {
      const { name, email } = rows[i];
      const rowNum = i + 2;

      if (!email) {
        failed++;
        results.push({
          row: rowNum,
          name,
          email,
          status: 'failed',
          error: 'Thiếu email',
        });
        continue;
      }

      if (!name || name.length < 2) {
        failed++;
        results.push({
          row: rowNum,
          name,
          email,
          status: 'failed',
          error: 'Tên phải có ít nhất 2 ký tự',
        });
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        failed++;
        results.push({
          row: rowNum,
          name,
          email,
          status: 'failed',
          error: 'Email không đúng định dạng',
        });
        continue;
      }

      if (emailSet.has(email.toLowerCase())) {
        failed++;
        results.push({
          row: rowNum,
          name,
          email,
          status: 'failed',
          error: 'Email đã tồn tại trong hệ thống',
        });
        continue;
      }

      const rawPassword = crypto.randomUUID().slice(0, 12) + 'Aa1';
      const hashedPassword = await bcrypt.hash(rawPassword, SALT_ROUNDS);

      try {
        const student = await this.prisma.studentAccount.create({
          data: {
            student_fullName: name,
            email,
            password: hashedPassword,
            organization_id,
            organization_name,
            import_batch_id: batch.id,
            imported_by: userId,
          },
        });

        emailSet.add(email.toLowerCase());
        success++;
        results.push({
          row: rowNum,
          name,
          email,
          status: 'success',
          student_id: student.student_id,
          password: rawPassword,
        });
      } catch (err: any) {
        failed++;
        results.push({
          row: rowNum,
          name,
          email,
          status: 'failed',
          error: err.message || 'Lỗi tạo tài khoản',
        });
      }
    }

    await this.prisma.studentImportBatch.update({
      where: { id: batch.id },
      data: { success_rows: success, failed_rows: failed },
    });

    return {
      batch_id: batch.id,
      total_rows: rows.length,
      success_rows: success,
      failed_rows: failed,
      results,
    };
  }

  async getImportHistory(organizationId: string) {
    return this.prisma.studentImportBatch.findMany({
      where: { organization_id: organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.studentAccount.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.studentAccount.findUnique({ where: { student_id: id } });
  }

  async findAll(organizationId: string) {
    return this.prisma.studentAccount.findMany({
      where: { organization_id: organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    studentId: string,
    organizationId: string,
    data: {
      name?: string;
      email?: string;
      isActive?: boolean;
      password?: string;
    },
  ) {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
    });

    if (!student || student.organization_id !== organizationId) {
      throw new NotFoundException(
        'Student account not found or does not belong to your organization.',
      );
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.student_fullName = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.email !== undefined && data.email !== student.email) {
      const existing = await this.prisma.studentAccount.findFirst({
        where: {
          email: data.email,
          NOT: { student_id: studentId },
        },
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }
      updateData.email = data.email;
    }

    if (data.password !== undefined && data.password) {
      updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    return this.prisma.studentAccount.update({
      where: { student_id: studentId },
      data: updateData,
    });
  }

  async updateProfile(
    studentId: string,
    data: { name?: string; email?: string },
  ) {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.student_fullName = data.name;
    if (data.email !== undefined && data.email !== student.email) {
      const existing = await this.prisma.studentAccount.findFirst({
        where: { email: data.email, NOT: { student_id: studentId } },
      });
      if (existing) throw new ConflictException('Email already exists');
      updateData.email = data.email;
    }

    return this.prisma.studentAccount.update({
      where: { student_id: studentId },
      data: updateData,
    });
  }

  async changePassword(
    studentId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.studentAccount.update({
      where: { student_id: studentId },
      data: { password: hashed },
    });
  }

  async delete(studentId: string, organizationId: string) {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
    });

    if (!student || student.organization_id !== organizationId) {
      throw new NotFoundException(
        'Student account not found or does not belong to your organization.',
      );
    }

    // Check if student has certificates. If they do, prevent deletion.
    const certCount = await this.prisma.certificate.count({
      where: { student_id: studentId },
    });

    if (certCount > 0) {
      throw new BadRequestException(
        'Cannot delete student because they have issued or pending certificates.',
      );
    }

    await this.prisma.studentAccount.delete({
      where: { student_id: studentId },
    });

    return { message: 'Student account deleted successfully' };
  }
}
