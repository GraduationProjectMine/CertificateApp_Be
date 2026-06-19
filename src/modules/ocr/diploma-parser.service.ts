import { Injectable } from '@nestjs/common';
import { DiplomaDataDto } from './ocr.dto';

@Injectable()
export class DiplomaParserService {
  parse(rawText: string): {
    data: DiplomaDataDto;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};
    const data: DiplomaDataDto = {};

    data.document_title = this.extractDocumentTitle(rawText, errors);
    data.full_name = this.extractFullName(rawText, errors);
    data.dob = this.extractDOB(rawText, errors);
    data.place_of_birth = this.extractPlaceOfBirth(rawText, errors);
    data.gender = this.extractGender(rawText, errors);
    data.ethnicity = this.extractEthnicity(rawText, errors);
    data.school_name = this.extractSchoolName(rawText, errors);
    data.exam_cohort = this.extractExamCohort(rawText, errors);
    data.exam_board = this.extractExamBoard(rawText, errors);

    const issueInfo = this.extractIssueInfo(rawText, errors);
    data.issue_location = issueInfo.location;
    data.issue_date = issueInfo.date;

    data.serial_number = this.extractSerialNumber(rawText, errors);
    data.registry_number = this.extractRegistryNumber(rawText, errors);

    return { data, errors };
  }

  private extractDocumentTitle(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    if (text.match(/BẰNG\s+TỐT\s+NGHIỆP\s+TRUNG\s+HỌC\s+PHỔ\s+THÔNG/i)) {
      return 'BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG';
    }
    errors['document_title'] = 'Document title not found';
    return undefined;
  }

  private extractFullName(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    const lines = text.split('\n').map((l) => l.trim());

    for (const line of lines) {
      // Look for a line that is ALL CAPS, at least 2 words, and isn't a known header/label
      if (
        line.length > 5 &&
        line.split(' ').length >= 2 &&
        /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]+$/.test(
          line,
        ) &&
        !line.match(
          /CỘNG HÒA|ĐỘC LẬP|BẰNG TỐT NGHIỆP|GIÁM ĐỐC|SỞ GIÁO DỤC|NAM|NỮ/i,
        )
      ) {
        return line;
      }
    }
    errors['full_name'] = 'Full name not found';
    return undefined;
  }

  private extractDOB(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    // Find all DD/MM/YYYY patterns in the text
    const dateMatches = [
      ...text.matchAll(/\b(\d{1,2})[\/\s-]+(\d{1,2})[\/\s-]+(\d{4})\b/g),
    ];

    for (const match of dateMatches) {
      const day = String(match[1]).padStart(2, '0');
      const month = String(match[2]).padStart(2, '0');
      const year = parseInt(match[3], 10);

      // DOB years are usually between 1980 and 2010 (excluding issue dates/exam cohorts which are ~2020+)
      if (
        year > 1980 &&
        year <= 2010 &&
        this.isValidDate(day, month, String(year))
      ) {
        return `${day}/${month}/${year}`;
      }
    }
    errors['dob'] = 'Date of birth not found';
    return undefined;
  }

  private extractPlaceOfBirth(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    // Attempt 1: Try to find it immediately after the label (DOCUMENT_TEXT_DETECTION often fixes this)
    const match = text.match(/Nơi\s+sinh:\s*([A-Za-zÀ-ỹ\s]+)/i);
    if (match && match[1].trim().length > 0 && match[1].trim().length < 30) {
      return match[1].trim();
    }
    errors['place_of_birth'] = 'Place of birth not found';
    return undefined;
  }

  private extractGender(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    // Simply look for standalone "Nam" or "Nữ"
    const lines = text.split('\n').map((l) => l.trim());
    for (const line of lines) {
      if (line.match(/^(Nam|Nữ)$/i)) {
        return line.charAt(0).toUpperCase() + line.slice(1).toLowerCase(); // Normalize casing
      }
    }
    errors['gender'] = 'Gender not found';
    return undefined;
  }

  private extractEthnicity(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    const lines = text.split('\n').map((l) => l.trim());
    const commonEthnicities = [
      'Kinh',
      'Tày',
      'Thái',
      'Mường',
      'Khmer',
      'Hoa',
      'Nùng',
      "H'Mông",
      'Dao',
    ];

    for (const line of lines) {
      const cleaned = line.replace(/Dân tộc:/i, '').trim();
      if (
        commonEthnicities.some((e) => cleaned.toLowerCase() === e.toLowerCase())
      ) {
        return cleaned;
      }
    }
    errors['ethnicity'] = 'Ethnicity not found';
    return undefined;
  }

  private extractSchoolName(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    // Look strictly for lines containing THPT or TTGDTX
    const match = text.match(/(THPT|TTGDTX)\s+([A-Za-zÀ-ỹ\s]+)/i);
    if (match) {
      return match[0].trim();
    }
    errors['school_name'] = 'School name not found';
    return undefined;
  }

  private extractExamCohort(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    const match = text.match(
      /Khóa\s+thi[^\d]*(\d{1,2})[\/\s-]+(\d{1,2})[\/\s-]+(\d{4})/i,
    );
    if (match) {
      const day = String(match[1]).padStart(2, '0');
      const month = String(match[2]).padStart(2, '0');
      const year = match[3];
      if (this.isValidDate(day, month, year)) return `${day}/${month}/${year}`;
    }
    errors['exam_cohort'] = 'Exam cohort not found';
    return undefined;
  }

  private extractExamBoard(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    const match = text.match(
      /(Sở\s+Giáo\s+dục\s+và\s+Đào\s+tạo\s+tỉnh\s+[A-Za-zÀ-ỹ\s]+)/i,
    );
    if (match) {
      return match[1].trim();
    }
    errors['exam_board'] = 'Exam board not found';
    return undefined;
  }

  private extractIssueInfo(
    text: string,
    errors: Record<string, string>,
  ): { location?: string; date?: string } {
    const result: { location?: string; date?: string } = {};
    const issuePattern =
      /([A-Za-zÀ-ỹ\s]+),\s+ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i;
    const match = text.match(issuePattern);

    if (match) {
      const locationCandidate = match[1]
        .trim()
        .replace(/Hội đồng thi:/i, '')
        .trim();
      result.location = locationCandidate;

      const day = String(match[2]).padStart(2, '0');
      const month = String(match[3]).padStart(2, '0');
      const year = match[4];
      if (this.isValidDate(day, month, year))
        result.date = `${day}/${month}/${year}`;
    } else {
      errors['issue_location'] = 'Issue location/date not found';
    }
    return result;
  }

  private extractSerialNumber(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    // Serial number is usually 1 uppercase letter followed by spaces and 8 digits
    const match = text.match(/([A-Z]\s+\d{8})/);
    if (match) return match[1].trim();

    errors['serial_number'] = 'Serial number not found';
    return undefined;
  }

  private extractRegistryNumber(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    // Registry number is usually an 8-10 digit string at the bottom
    const match = text.match(/sổ\s+cấp\s+bằng:\s*([A-Z0-9]{8,10})/i);
    if (match) return match[1].trim();

    errors['registry_number'] = 'Registry number not found';
    return undefined;
  }

  private isValidDate(day: string, month: string, year: string): boolean {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (y < 1900 || y > new Date().getFullYear()) return false;
    return true;
  }
}
