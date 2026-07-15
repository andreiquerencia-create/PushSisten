import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client, getBucketConfig } from './aws-config';

const s3 = createS3Client();

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
) {
  const { bucketName, folderPrefix } = getBucketConfig();
  const prefix = isPublic ? 'public/uploads' : 'uploads';
  const cloud_storage_path = `${folderPrefix}${prefix}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? 'attachment' : undefined,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path };
}

export async function getFileUrl(cloud_storage_path: string, isPublic: boolean) {
  const { bucketName } = getBucketConfig();
  if (isPublic) {
    const region = process.env.AWS_REGION ?? 'us-east-1';
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
  }
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ResponseContentDisposition: 'attachment',
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteFile(cloud_storage_path: string) {
  const { bucketName } = getBucketConfig();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });
  await s3.send(command);
}

// FASE 7 — baixa um objeto do S3 como string (uso interno: restore de backup).
import { GetObjectCommand as _GetObjectCommand } from '@aws-sdk/client-s3';
export async function getObjectString(cloud_storage_path: string): Promise<string> {
  const { bucketName } = getBucketConfig();
  const res = await s3.send(new _GetObjectCommand({ Bucket: bucketName, Key: cloud_storage_path }));
  // @ts-ignore - Body é um stream legível no Node
  const body: any = res.Body;
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
}
