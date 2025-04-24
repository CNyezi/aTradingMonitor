import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface UploadOptions {
  data: Buffer | string;
  fileName?: string;
  contentType: string;
  path?: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

export const createR2Client = () => new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const uploadFile = async ({
  data,
  fileName,
  contentType,
  path = '',
}: UploadOptions): Promise<UploadResult> => {
  if (!process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
    throw new Error('R2 configuration is missing');
  }

  const s3Client = createR2Client();
  const fileBuffer = Buffer.isBuffer(data)
    ? data
    : Buffer.from(data.replace(/^data:.*?;base64,/, ''), 'base64');

  const finalFileName = fileName || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.png`;

  const key = path
    ? path.endsWith('/') ? `${path}${finalFileName}` : `${path}/${finalFileName}`
    : finalFileName;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }));

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;

    return { url, key };
  } catch (error) {
    console.error('Failed to upload file to R2:', error);
    throw new Error('Failed to upload file to R2');
  }
};

export const deleteFile = async (key: string): Promise<void> => {
  if (!process.env.R2_BUCKET_NAME) {
    throw new Error('R2 configuration is missing');
  }

  const s3Client = createR2Client();

  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
  } catch (error) {
    console.error('Failed to delete file from R2:', error);
    throw new Error('Failed to delete file from R2');
  }
}; 