import { Test, TestingModule } from '@nestjs/testing';
import { DiplomaParserService } from './diploma-parser.service';

describe('DiplomaParserService', () => {
  let service: DiplomaParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiplomaParserService],
    }).compile();

    service = module.get<DiplomaParserService>(DiplomaParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should correctly parse Image 1 (TP HCM - Tran Ngoc Khoa)', () => {
    const rawText = `Họ và tên:
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG
Ngày, tháng, năm sinh:
TRẦN NGỌC KHOA
21/03/1997
Thành phố Hồ Chí Minh
Nơi sinh:
Giới tỉnh:
Nữ
Dân tộc:
Học sinh trưởng:
Khoa thì
01/7/2015
Số hiệu: B589312
Số vào số cấp bằng:
Kinh
THPT NGUYỄN THÁI BÌNH
Hội đồng thi: Đại học Quốc gia Thành phố Hồ Chí Minh
Thành phố Hồ Chí Minh, ngày 30 tháng 12 năm 2015
GIẢM ĐỐC SỞ GIÁO DỤC VÀ ĐÀO TẠO
02047-0199
sa
HÀNH PHỐ HỒ CHÍ MINH
VA
BAO TAO
Lé Hong Son`;

    const result = service.parse(rawText);
    expect(result.data.document_title).toBe('BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG');
    expect(result.data.full_name).toBe('TRẦN NGỌC KHOA');
    expect(result.data.dob).toBe('21/03/1997');
    expect(result.data.place_of_birth).toBe('Thành phố Hồ Chí Minh');
    expect(result.data.gender).toBe('Nữ');
    expect(result.data.ethnicity).toBe('Kinh');
    expect(result.data.school_name).toBe('THPT NGUYỄN THÁI BÌNH');
    expect(result.data.exam_cohort).toBe('01/07/2015');
    expect(result.data.exam_board).toBe('Đại học Quốc gia Thành phố Hồ Chí Minh');
    expect(result.data.issue_location).toBe('Thành phố Hồ Chí Minh');
    expect(result.data.issue_date).toBe('30/12/2015');
    expect(result.data.serial_number).toBe('B 589312');
    expect(result.data.registry_number).toBe('02047-0199');
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('should correctly parse Image 2 (Bac Ninh - Ta Thi Huong)', () => {
    const rawText = `Họ và tên:
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG
Ngày, tháng, năm sinh:
TẠ THỊ HƯƠNG
27/01/2000
Nơi sinh:
BẮC NINH.
Giới tính:
Nữ
Dân tộc:
Học sinh trường:
Khóa thi:
25/06/2018
Kinh
TT GDNN-GDTX Lương Tài
Hội đồng thi:
2018/19/068/5638
Số hiệu: B
2895162
Số vào số cấp bằng:
G
Sở GD&ĐT Bắc Ninh
Bắc Ninh, ngày 10 tháng 10 năm 2018
GIÁM ĐỐC SỞ GIÁO DỤC VÀ ĐÀO TẠO
X.HC.N, BẮC NINH
HOA
CONG H
SO
GIÁO DỤ
VA
VIET NA
ĐÀO TẠO
TINH
BẮC NINH
-
KT. GIÁM ĐỐC
PHÓ GIÁM ĐỐC
NGUYỄN THẾ SƠN`;

    const result = service.parse(rawText);
    expect(result.data.document_title).toBe('BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG');
    expect(result.data.full_name).toBe('TẠ THỊ HƯƠNG');
    expect(result.data.dob).toBe('27/01/2000');
    expect(result.data.place_of_birth).toContain('Bắc Ninh');
    expect(result.data.gender).toBe('Nữ');
    expect(result.data.ethnicity).toBe('Kinh');
    expect(result.data.school_name).toBe('TT GDNN-GDTX Lương Tài');
    expect(result.data.exam_cohort).toBe('25/06/2018');
    expect(result.data.exam_board).toBe('Sở GD&ĐT Bắc Ninh');
    expect(result.data.issue_location).toBe('Bắc Ninh');
    expect(result.data.issue_date).toBe('10/10/2018');
    expect(result.data.serial_number).toBe('B 2895162');
    expect(result.data.registry_number).toBe('2018/19/068/5638');
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('should correctly parse Image 3 (Thai Binh - Vu Thi Van Anh)', () => {
    const rawText = `Họ và tên:
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG
Ngày, tháng, năm sinh:
Nơi sinh:
Giới tính:
Nữ
Học sinh trường:
Khóa thi: 25-06-2019
VŨ THỊ VÂN ANH
31-01-2001
THÁI BÌNH
Dân tộc:
Kinh
THPT Bắc Đông Quan
Hội đồng thi: Sở GDĐT Thái Bình
Số hiệu: B 37345
Số vào số cấp bằng: 001/BĐQ
Thái Bình, ngày 20 tháng 09 năm 2019
GIÁM ĐỐC SỞ GIÁO DỤC VÀ ĐÀO TẠO
COME FOR
ADICHU
SO
ÔNG THÁI BÌNH
GIÁO DỤC free
VA DAO TAO
THAI
BINH
Nguyễn Viết Hiển`;

    const result = service.parse(rawText);
    expect(result.data.document_title).toBe('BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG');
    expect(result.data.full_name).toBe('VŨ THỊ VÂN ANH');
    expect(result.data.dob).toBe('31/01/2001');
    expect(result.data.place_of_birth).toContain('THÁI BÌNH');
    expect(result.data.gender).toBe('Nữ');
    expect(result.data.ethnicity).toBe('Kinh');
    expect(result.data.school_name).toBe('THPT Bắc Đông Quan');
    expect(result.data.exam_cohort).toBe('25/06/2019');
    expect(result.data.exam_board).toBe('Sở GDĐT Thái Bình');
    expect(result.data.issue_location).toBe('Thái Bình');
    expect(result.data.issue_date).toBe('20/09/2019');
    expect(result.data.serial_number).toBe('B 37345');
    expect(result.data.registry_number).toBe('001/BĐQ');
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('should correctly parse Image 4 (Da Nang - Nguyen Minh Cuong)', () => {
    const rawText = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG
Họ và tên:
Ngày, tháng, năm sinh:.
NGUYỄN MINH CƯỜNG.
03/07/2001
.Đà Nẵng
Nơi sinh:.
Giới tính: Nam
Dân tộc:.
Kinh
Học sinh trường
THPT Quang Trung
Khóa thi: 25/06/2019... Hội đồng thi: .....Sở Giáo dục và Đào tạo Đà Nẵng
Số hiệu: B 4061915
Số vào sổ cấp bằng: 7735-2019 TKH
Đà Nẵng, ngày 19 tháng 10 năm 2019
VIỆT NAM GIÁM ĐỐC SỞ GIÁO DỤC VÀ ĐÀO TẠO
CỘNG HOÀ XÃ,
SO
THÀNH PHỐ ĐÀ NẴNG.
NGHĨA
GIÁO DỤC
VÀ ĐÀO TẠO
NANG
huau
THÀNH PHỐ Lê Thị Bích Thuận`;

    const result = service.parse(rawText);
    expect(result.data.document_title).toBe('BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG');
    expect(result.data.full_name).toBe('NGUYỄN MINH CƯỜNG');
    expect(result.data.dob).toBe('03/07/2001');
    expect(result.data.place_of_birth).toContain('Đà Nẵng');
    expect(result.data.gender).toBe('Nam');
    expect(result.data.ethnicity).toBe('Kinh');
    expect(result.data.school_name).toBe('THPT Quang Trung');
    expect(result.data.exam_cohort).toBe('25/06/2019');
    expect(result.data.exam_board).toBe('Sở Giáo dục và Đào tạo Đà Nẵng');
    expect(result.data.issue_location).toBe('Đà Nẵng');
    expect(result.data.issue_date).toBe('19/10/2019');
    expect(result.data.serial_number).toBe('B 4061915');
    expect(result.data.registry_number).toBe('7735-2019 TKH');
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('should correctly parse hyphenated serial number and registry number', () => {
    const rawText = `BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG
Họ và tên: NGUYỄN VĂN AN
Ngày sinh: 15/05/2000
Nơi sinh: Hà Nội
Giới tính: Nam
Dân tộc: Kinh
Học sinh trường: THPT Chuyên Hà Nội
Khóa thi: 25/06/2018
Hội đồng thi: Sở Giáo dục và Đào tạo Hà Nội
Số hiệu: BK-2025-001
Số vào sổ cấp bằng: 02047-0199/THPT
Hà Nội, ngày 10 tháng 10 năm 2018`;

    const result = service.parse(rawText);
    expect(result.data.serial_number).toBe('BK-2025-001');
    expect(result.data.registry_number).toBe('02047-0199/THPT');
    expect(Object.keys(result.errors).length).toBe(0);
  });
});
