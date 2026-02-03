import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
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
  if (!process.env.S3_BUCKET || !process.env.S3_PUBLIC_URL_BASE) {
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
    fileUrl: `${process.env.S3_PUBLIC_URL_BASE}/${params.key}`
  };
}
