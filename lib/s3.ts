import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.S3_REGION || "us-east-1";

const s3 = new S3Client({
  region,
  credentials: process.env.S3_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ""
      }
    : undefined
});

export type UploadResult = {
  storageKey: string;
  fileUrl: string;
};

export async function uploadToS3(params: {
  key: string;
  body: Uint8Array;
  contentType: string;
}): Promise<UploadResult> {
  if (!process.env.S3_BUCKET) {
    // TODO: Wire real object storage for production deployments
    throw new Error("S3 configuration missing");
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType
    })
  );

  return {
    storageKey: params.key,
    // Reference only — the bucket is private, so this URL is not directly fetchable.
    // Use getSignedDownloadUrl(storageKey) to actually view/download the file.
    fileUrl: `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${params.key}`
  };
}

export async function getSignedDownloadUrl(storageKey: string, expiresInSeconds = 300): Promise<string> {
  if (!process.env.S3_BUCKET) {
    throw new Error("S3 configuration missing");
  }

  const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: storageKey });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

export async function deleteFromS3(storageKey: string): Promise<void> {
  if (!process.env.S3_BUCKET) {
    throw new Error("S3 configuration missing");
  }

  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: storageKey }));
}
