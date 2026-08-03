import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private clean(val?: string): string {
    if (!val) return '';
    return val.trim().replace(/^["']|["']$/g, '');
  }

  private configureCloudinary() {
    const cloudinaryUrl = this.clean(process.env.CLOUDINARY_URL);
    const cloudName = this.clean(process.env.CLOUDINARY_CLOUD_NAME);
    const apiKey = this.clean(process.env.CLOUDINARY_API_KEY);
    const apiSecret = this.clean(process.env.CLOUDINARY_API_SECRET);

    if (cloudinaryUrl) {
      cloudinary.config({ cloudinary_url: cloudinaryUrl });
      return true;
    }

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      return true;
    }

    return false;
  }

  /**
   * Upload an image buffer to Cloudinary
   * @param fileBuffer Binary buffer of the image file
   * @param folder Destination folder in Cloudinary
   * @param filename Optional custom filename identifier
   */
  async uploadImage(
    fileBuffer: Buffer,
    folder = 'organization_logos',
    filename?: string,
  ): Promise<{ url: string; public_id: string }> {
    const isConfigured = this.configureCloudinary();

    if (!isConfigured) {
      throw new InternalServerErrorException(
        'Cloudinary credentials are missing or incomplete. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in backend/.env and restart the server.',
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          public_id: filename
            ? `${Date.now()}_${filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')}`
            : undefined,
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            let userFriendlyMsg = `Cloudinary upload error (${error.http_code || 403}): ${error.message}`;

            if (error.http_code === 403 || error.message?.includes('403')) {
              userFriendlyMsg =
                'Cloudinary 403 Forbidden: Invalid credentials signature. ' +
                'Please double-check your CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env. ' +
                'Make sure there are no quotes or extra spaces, and verify your account email is confirmed on cloudinary.com.';
            }

            return reject(new InternalServerErrorException(userFriendlyMsg));
          }

          if (!result) {
            return reject(
              new InternalServerErrorException('Cloudinary upload error: Received empty response from server'),
            );
          }

          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );

      uploadStream.end(fileBuffer);
    });
  }
}
