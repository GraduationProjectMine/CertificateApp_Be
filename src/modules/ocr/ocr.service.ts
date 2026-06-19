import { Injectable, OnModuleInit } from '@nestjs/common';
import * as vision from '@google-cloud/vision';
import * as path from 'path';

export interface OcrResult {
  extractedText: string;
  accuracy: number;
  language: string;
}

@Injectable()
export class OcrService implements OnModuleInit {
  private client: vision.ImageAnnotatorClient;

  onModuleInit() {
    let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credentialsPath) {
      if (!path.isAbsolute(credentialsPath)) {
        credentialsPath = path.join(process.cwd(), credentialsPath);
      }
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
      console.log(`Using credentials: ${credentialsPath}`);
    } else {
      console.warn(
        'GOOGLE_APPLICATION_CREDENTIALS not set. Google Cloud Vision will not work.',
      );
    }

    this.client = new vision.ImageAnnotatorClient();
  }

  async extractTextFromImage(
    imageBuffer: Buffer,
    language: string = 'eng',
  ): Promise<OcrResult> {
    try {
      const request = {
        image: {
          content: imageBuffer.toString('base64'),
        },
        features: [
          {
            // CHANGED: Use DOCUMENT_TEXT_DETECTION for forms and certificates
            type: 'DOCUMENT_TEXT_DETECTION',
          },
        ],
        imageContext: {
          languageHints: [this.mapLanguageCode(language)],
        },
      };

      const responses = await this.client.annotateImage(request as any);
      const result = responses[0];

      if (!result.textAnnotations || result.textAnnotations.length === 0) {
        return { extractedText: '', accuracy: 0, language };
      }

      const fullTextAnnotation = result.fullTextAnnotation;
      const extractedText = fullTextAnnotation?.text || '';
      const accuracy = this.calculateAccuracy(result.textAnnotations);

      return {
        extractedText: extractedText.trim(),
        accuracy,
        language,
      };
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  private mapLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      eng: 'en',
      vie: 'vi',
      fra: 'fr',
      deu: 'de',
      spa: 'es',
      jpn: 'ja',
      chi_sim: 'zh-CN',
      chi_tra: 'zh-TW',
    };
    return languageMap[language] || 'en';
  }

  private calculateAccuracy(textAnnotations: any[]): number {
    if (!textAnnotations || textAnnotations.length === 0) return 0;
    const accuracies = textAnnotations
      .slice(1)
      .map((annotation) => annotation.confidence || 0);

    if (accuracies.length === 0) return 0;
    const averageAccuracy =
      accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    return Math.round(averageAccuracy * 100);
  }
}
