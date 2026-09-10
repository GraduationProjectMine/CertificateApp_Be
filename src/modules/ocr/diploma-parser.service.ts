import { Injectable } from '@nestjs/common';
import { DiplomaDataDto } from './ocr.dto';

const PROVINCES = [
  'Hà Nội',
  'Hồ Chí Minh',
  'Thành phố Hồ Chí Minh',
  'TP. Hồ Chí Minh',
  'TP Hồ Chí Minh',
  'TP.HCM',
  'TPHCM',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'An Giang',
  'Bà Rịa - Vũng Tàu',
  'Bà Rịa Vũng Tàu',
  'Bắc Giang',
  'Bắc Kạn',
  'Bạc Liêu',
  'Bắc Ninh',
  'Bến Tre',
  'Bình Định',
  'Bình Dương',
  'Bình Phước',
  'Bình Thuận',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Đắk Nông',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Giang',
  'Hà Nam',
  'Hà Tĩnh',
  'Hải Dương',
  'Hậu Giang',
  'Hòa Bình',
  'Hưng Yên',
  'Khánh Hòa',
  'Kiên Giang',
  'Kon Tum',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Long An',
  'Nam Định',
  'Nghệ An',
  'Ninh Bình',
  'Ninh Thuận',
  'Phú Thọ',
  'Phú Yên',
  'Quảng Bình',
  'Quảng Nam',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sóc Trăng',
  'Sơn La',
  'Tây Ninh',
  'Thái Bình',
  'Thái Nguyên',
  'Thanh Hóa',
  'Thừa Thiên Huế',
  'Tiền Giang',
  'Trà Vinh',
  'Tuyên Quang',
  'Vĩnh Long',
  'Vĩnh Phúc',
  'Yên Bái',
];

@Injectable()
export class DiplomaParserService {
  parse(rawText: string): {
    data: DiplomaDataDto;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};
    const data: DiplomaDataDto = {};

    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    data.document_title = this.extractDocumentTitle(rawText, errors);
    data.dob = this.extractDOB(rawText, lines, errors);
    data.full_name = this.extractFullName(rawText, lines, data.dob, errors);
    data.place_of_birth = this.extractPlaceOfBirth(
      rawText,
      lines,
      data.dob,
      errors,
    );
    data.gender = this.extractGender(rawText, lines, errors);
    data.ethnicity = this.extractEthnicity(rawText, errors);
    data.school_name = this.extractSchoolName(rawText, lines, errors);
    data.exam_cohort = this.extractExamCohort(rawText, lines, errors);
    data.exam_board = this.extractExamBoard(rawText, errors);

    const issueInfo = this.extractIssueInfo(rawText, lines, errors);
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
    if (/BẰNG\s+TỐT\s+NGHIỆP\s+TRUNG\s+HỌC\s+PHỔ\s+THÔNG/i.test(text)) {
      return 'BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG';
    }
    if (/BANG\s+TOT\s+NGHIEP\s+TRUNG\s+HOC\s+PHO\s+THONG/i.test(text)) {
      return 'BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG';
    }
    errors['document_title'] = 'Document title not found';
    return undefined;
  }

  private extractDOB(
    text: string,
    lines: string[],
    errors: Record<string, string>,
  ): string | undefined {
    const dobLabelMatch = text.match(
      /(?:Ngày[,\s]+tháng[,\s]+năm\s+sinh|Ngày\s+sinh)[^\n\d]*(\d{1,2})[\/\s-]+(\d{1,2})[\/\s-]+(\d{4})/i,
    );
    if (dobLabelMatch) {
      const day = dobLabelMatch[1].padStart(2, '0');
      const month = dobLabelMatch[2].padStart(2, '0');
      const year = dobLabelMatch[3];
      if (this.isValidDate(day, month, year)) {
        return `${day}/${month}/${year}`;
      }
    }

    const dateRegex = /\b(\d{1,2})[\/\s-]+(\d{1,2})[\/\s-]+(\d{4})\b/g;
    const candidates: { day: string; month: string; year: number; str: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = dateRegex.exec(text)) !== null) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = parseInt(match[3], 10);
      if (this.isValidDate(day, month, String(year))) {
        candidates.push({
          day,
          month,
          year,
          str: `${day}/${month}/${year}`,
        });
      }
    }

    const studentCandidate = candidates.find(
      (c) => c.year >= 1980 && c.year <= 2015,
    );
    if (studentCandidate) {
      return studentCandidate.str;
    }

    errors['dob'] = 'Date of birth not found';
    return undefined;
  }

  private extractFullName(
    text: string,
    lines: string[],
    dob: string | undefined,
    errors: Record<string, string>,
  ): string | undefined {
    if (dob) {
      const [day, , year] = dob.split('/');
      const dobIndex = lines.findIndex(
        (l) => l.includes(day) && l.includes(year),
      );
      if (dobIndex > 0) {
        for (let i = dobIndex - 1; i >= 0; i--) {
          const line = lines[i].replace(/^[.\s:]+|[.:\s]+$/g, '').trim();
          if (
            line.length > 3 &&
            !/CỘNG HÒA|ĐỘC LẬP|BẰNG TỐT NGHIỆP|Họ và tên|Ngày.*sinh|Nơi sinh|Khóa thi|Hội đồng|Giới tính|Dân tộc/i.test(
              line,
            ) &&
            /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]+$/.test(
              line,
            )
          ) {
            return line;
          }
        }
      }
    }

    const nameMatch = text.match(
      /(?:Họ\s*(?:và|v\.)?\s*tên|Họ\s*tên)[^\n:]*[:.]?\s*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]+)/i,
    );
    if (nameMatch && nameMatch[1].trim().length > 3) {
      const candidate = nameMatch[1].replace(/^[.\s:]+|[.:\s]+$/g, '').trim();
      if (
        !/CỘNG HÒA|ĐỘC LẬP|BẰNG TỐT NGHIỆP|GIÁM ĐỐC|SỞ GIÁO DỤC/i.test(candidate)
      ) {
        return candidate;
      }
    }

    for (const line of lines) {
      const cleaned = line.replace(/^[.\s:]+|[.:\s]+$/g, '').trim();
      if (
        cleaned.length > 5 &&
        cleaned.split(' ').length >= 2 &&
        /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]+$/.test(
          cleaned,
        ) &&
        !/CỘNG HÒA|ĐỘC LẬP|BẰNG TỐT NGHIỆP|GIÁM ĐỐC|SỞ GIÁO DỤC|NAM|NỮ|THÀNH PHỐ|TỈNH|THPT|KT\.\s*GIÁM\s*ĐỐC|PHÓ\s*GIÁM\s*ĐỐC/i.test(
          cleaned,
        )
      ) {
        return cleaned;
      }
    }

    errors['full_name'] = 'Full name not found';
    return undefined;
  }

  private extractPlaceOfBirth(
    text: string,
    lines: string[],
    dob: string | undefined,
    errors: Record<string, string>,
  ): string | undefined {
    const pMatch = text.match(
      /(?:Nơi\s+sinh|Noi\s+sinh)[^\n:]*[:.]?\s*([A-Za-zÀ-ỹ\s.]+)/i,
    );
    if (pMatch && pMatch[1].trim().length > 2 && !/Giới|Nam|Nữ|Dân/i.test(pMatch[1])) {
      const rawPlace = pMatch[1].replace(/^[.\s]+|[.\s]+$/g, '').trim();
      if (rawPlace.length > 2) return rawPlace;
    }

    if (dob) {
      const [day, , year] = dob.split('/');
      const dobIndex = lines.findIndex(
        (l) => l.includes(day) && l.includes(year),
      );
      if (dobIndex >= 0 && dobIndex + 1 < lines.length) {
        const nextLine = lines[dobIndex + 1]
          .replace(/^[.\s]+|[.\s]+$/g, '')
          .trim();
        if (
          !/Nơi sinh|Giới|Nam|Nữ|Dân tộc|Học sinh|Khóa thi/i.test(nextLine) &&
          nextLine.length > 2
        ) {
          return nextLine;
        }
      }
    }

    for (const p of PROVINCES) {
      const pNorm = this.normalizeText(p);
      const found = lines.find((l) => {
        const lNorm = this.normalizeText(l);
        return (
          lNorm === pNorm ||
          (lNorm.includes(pNorm) &&
            !lNorm.includes('sở giáo dục') &&
            !lNorm.includes('hội đồng') &&
            !lNorm.includes('giám đốc') &&
            !lNorm.includes('học sinh'))
        );
      });
      if (found) {
        return p;
      }
    }

    errors['place_of_birth'] = 'Place of birth not found';
    return undefined;
  }

  private extractGender(
    text: string,
    lines: string[],
    errors: Record<string, string>,
  ): string | undefined {
    const genderMatch = text.match(
      /(?:Giới\s*t[iíỉ]nh|Gioi\s*tinh)[^\n:]*[:.]?\s*(Nam|Nữ)\b/i,
    );
    if (genderMatch) {
      return genderMatch[1].toLowerCase() === 'nam' ? 'Nam' : 'Nữ';
    }

    const gIdx = lines.findIndex((l) => /Giới\s*t[iíỉ]nh/i.test(l));
    if (gIdx >= 0 && gIdx + 1 < lines.length) {
      const nextLine = lines[gIdx + 1].trim();
      if (/^(Nam|Nữ)$/i.test(nextLine)) {
        return nextLine.toLowerCase() === 'nam' ? 'Nam' : 'Nữ';
      }
    }

    const textWithoutVN = text.replace(/VIỆT\s*NAM/gi, '');
    if (/\bNữ\b/i.test(textWithoutVN)) {
      return 'Nữ';
    }
    if (/\bNam\b/i.test(textWithoutVN)) {
      return 'Nam';
    }

    errors['gender'] = 'Gender not found';
    return undefined;
  }

  private extractEthnicity(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
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
      'Gia Rai',
      'Ê Đê',
      'Ba Na',
    ];

    for (const eth of commonEthnicities) {
      const ethRegex = new RegExp(
        `(?:Dân\\s*tộc[^\n:]*[:.]?\\s*|\\b)${eth}\\b`,
        'i',
      );
      if (ethRegex.test(text)) {
        return eth;
      }
    }

    errors['ethnicity'] = 'Ethnicity not found';
    return undefined;
  }

  private extractSchoolName(
    text: string,
    lines: string[],
    errors: Record<string, string>,
  ): string | undefined {
    const schoolMatch = text.match(
      /(THPT|TT[ \t]*GDNN[-\s]*GDTX|TTGDTX|Trường[ \t]+THPT)[ \t]+([^\n.,;]+)/i,
    );
    if (schoolMatch) {
      return schoolMatch[0].trim();
    }

    const schLineMatch = text.match(
      /(?:Học\s*sinh\s*trư[ơờ]ng|Hoc\s*sinh\s*truong)[^\n:]*[:.]?\s*([^\n]+)/i,
    );
    if (schLineMatch && schLineMatch[1].trim().length > 3) {
      const val = schLineMatch[1].replace(/^[.\s]+|[.\s]+$/g, '').trim();
      if (!/Khóa\s*thi|Hội\s*đồng/i.test(val)) {
        return val;
      }
    }

    const schIdx = lines.findIndex((l) => /Học\s*sinh\s*trư[ơờ]ng/i.test(l));
    if (schIdx >= 0 && schIdx + 1 < lines.length) {
      const candidate = lines[schIdx + 1].trim();
      if (candidate.length > 3 && !/Khóa\s*thi|Hội\s*đồng/i.test(candidate)) {
        return candidate;
      }
    }

    errors['school_name'] = 'School name not found';
    return undefined;
  }

  private extractExamCohort(
    text: string,
    lines: string[],
    errors: Record<string, string>,
  ): string | undefined {
    const cohortMatch = text.match(
      /(?:Khóa\s*thi|Khoa\s*thì|Khoa\s*thi)[^\n\d]*(\d{1,2})[\/\s-]+(\d{1,2})[\/\s-]+(\d{4})/i,
    );
    if (cohortMatch) {
      const day = cohortMatch[1].padStart(2, '0');
      const month = cohortMatch[2].padStart(2, '0');
      const year = cohortMatch[3];
      if (this.isValidDate(day, month, year)) {
        return `${day}/${month}/${year}`;
      }
    }

    const cohortIdx = lines.findIndex((l) => /Khóa\s*thi|Khoa\s*thì/i.test(l));
    if (cohortIdx >= 0 && cohortIdx + 1 < lines.length) {
      const nextMatch = lines[cohortIdx + 1].match(
        /(\d{1,2})[\/\s-]+(\d{1,2})[\/\s-]+(\d{4})/,
      );
      if (nextMatch) {
        const day = nextMatch[1].padStart(2, '0');
        const month = nextMatch[2].padStart(2, '0');
        const year = nextMatch[3];
        if (this.isValidDate(day, month, year)) {
          return `${day}/${month}/${year}`;
        }
      }
    }

    errors['exam_cohort'] = 'Exam cohort not found';
    return undefined;
  }

  private extractExamBoard(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    const boardMatch = text.match(/Hội\s*đồng\s*thi[^\n:]*[:.]?\s*([^\n]+)/i);
    if (
      boardMatch &&
      boardMatch[1].replace(/^[.\s]+|[.\s]+$/g, '').length > 3
    ) {
      const candidate = boardMatch[1].replace(/^[.\s]+|[.\s]+$/g, '').trim();
      if (!/^\d/.test(candidate)) {
        return candidate;
      }
    }

    const boardFallback = text.match(
      /(Sở\s*(?:Giáo\s*dục\s*và\s*Đào\s*tạo|GD\s*[&và]?\s*ĐT)\s+[A-Za-zÀ-ỹ\s]+|Đại\s*học\s*Quốc\s*gia\s+[A-Za-zÀ-ỹ\s]+)/i,
    );
    if (boardFallback) {
      return boardFallback[1].trim().split('\n')[0].trim();
    }

    errors['exam_board'] = 'Exam board not found';
    return undefined;
  }

  private extractIssueInfo(
    text: string,
    lines: string[],
    errors: Record<string, string>,
  ): { location?: string; date?: string } {
    const result: { location?: string; date?: string } = {};

    const issueLine = lines.find((l) =>
      /ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}/i.test(l),
    );

    if (issueLine) {
      const m = issueLine.match(
        /([A-Za-zÀ-ỹ\s]+?)[,\s.]*ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i,
      );
      if (m) {
        result.location = m[1].replace(/^[.\s]+|[.\s]+$/g, '').trim();
        const day = m[2].padStart(2, '0');
        const month = m[3].padStart(2, '0');
        const year = m[4];
        if (this.isValidDate(day, month, year)) {
          result.date = `${day}/${month}/${year}`;
        }
      }
    }

    if (!result.date) {
      const m = text.match(
        /([A-Za-zÀ-ỹ\s]+?)[,\s.]*ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i,
      );
      if (m) {
        const lastLine = m[1]
          .split('\n')
          .pop()!
          .replace(/^[.\s]+|[.\s]+$/g, '')
          .trim();
        result.location = lastLine;
        const day = m[2].padStart(2, '0');
        const month = m[3].padStart(2, '0');
        const year = m[4];
        if (this.isValidDate(day, month, year)) {
          result.date = `${day}/${month}/${year}`;
        }
      }
    }

    if (!result.location || !result.date) {
      errors['issue_location'] = 'Issue location/date not found';
    }

    return result;
  }

  private extractSerialNumber(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    // 1. Check content on the same line as "Số hiệu"
    const labelLineMatch = text.match(/Số\s*hiệu[^\n:]*[:.]?\s*([^\n]+)/i);
    if (labelLineMatch) {
      const lineVal = labelLineMatch[1].replace(/^[.\s]+|[.\s]+$/g, '').trim();
      // Case 1A: Single uppercase letter directly followed by optional space and digits (e.g. "B589312" -> "B 589312")
      const singleLetterMatch = lineVal.match(/^([A-Z])\s*(\d{5,10})$/i);
      if (singleLetterMatch) {
        return `${singleLetterMatch[1].toUpperCase()} ${singleLetterMatch[2]}`;
      }
      // Case 1B: Hyphenated or formatted serial (e.g. "BK-2025-001", "B-589312", "0123-4567")
      const candidate = lineVal.match(
        /([A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+)?)/,
      );
      if (candidate && candidate[1].length >= 4) {
        return candidate[1].trim();
      }
    }

    // 2. Multiline where prefix letter is on the first line and numbers on next line (e.g. Image 2)
    const multiLineMatch =
      text.match(
        /Số\s*hiệu[^\n:]*[:.]?\s*([A-Za-z]{1,4})\s*\n\s*([0-9-]{4,10})/i,
      ) || text.match(/([A-Za-z]{1,4})\s*\n\s*([0-9-]{5,10})/);
    if (multiLineMatch) {
      return `${multiLineMatch[1].toUpperCase()} ${multiLineMatch[2]}`;
    }

    // 3. Standalone pattern like "B 589312" or "BK-2025-001"
    const standaloneMatch = text.match(/\b([A-Za-z]{1,4}\s*[0-9-]{5,10})\b/);
    if (standaloneMatch) {
      return standaloneMatch[1].replace(/\s+/g, ' ').trim();
    }

    errors['serial_number'] = 'Serial number not found';
    return undefined;
  }

  private extractRegistryNumber(
    text: string,
    errors: Record<string, string>,
  ): string | undefined {
    const regLabelMatch = text.match(
      /(?:Số\s*vào\s*s[ổố]\s*cấp\s*bằng|Số\s*cấp\s*bằng)[^\n:]*[:.]?\s*([^\n]+)/i,
    );
    if (regLabelMatch) {
      const rawVal = regLabelMatch[1].replace(/^[.\s]+|[.\s]+$/g, '').trim();
      const candidate = rawVal.match(
        /([0-9A-Za-zÀ-ỹ\/\-]+(?:\s+[0-9A-Za-zÀ-ỹ\/\-]+)?)/,
      );
      if (
        candidate &&
        candidate[1].length >= 3 &&
        !/^(?:Giám|Kinh|CỘNG)/i.test(candidate[1]) &&
        !/^THPT\s+[A-Za-zÀ-ỹ]/i.test(candidate[1])
      ) {
        return candidate[1].trim();
      }
    }

    const complexRegMatch =
      text.match(/(?<![A-Za-z0-9-])(\d{4}\/\d{1,3}\/\d{1,3}\/\d{1,4})\b/) ||
      text.match(/(?<![A-Za-z0-9-])(\d{4,5}[-\/]\d{3,5})\b/) ||
      text.match(/(?<![A-Za-z0-9-])(\d{2,4}\/[A-Za-zÀ-ỹ0-9-]+)\b/) ||
      text.match(/(?<![A-Za-z0-9-])(\d{4}[-\/]\d{4}[\/\s]+[A-Za-zÀ-ỹ0-9\/-]+)\b/);

    if (complexRegMatch) {
      return complexRegMatch[1].trim();
    }

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

  private normalizeText(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
