"use server";

import { createR2Client, deleteFile as deleteR2Util } from "@/lib/cloudflare/r2";
import { ListObjectsV2Command, _Object } from "@aws-sdk/client-s3";
import { z } from "zod";

export interface R2File {
  key: string;
  size: number;
  lastModified: Date;
  type: string;
}

export interface ListR2FilesResult {
  files: R2File[];
  nextContinuationToken?: string;
  error?: string;
}

export interface DeleteR2FileResult {
  success: boolean;
  error?: string;
}

const listSchema = z.object({
  categoryPrefix: z.string(),
  filterPrefix: z.string().optional(),
  continuationToken: z.string().optional(),
  pageSize: z.number().int().positive().max(100).default(20),
});

const deleteSchema = z.object({
  key: z.string().min(1, "File key cannot be empty"),
});

export async function listR2Files(
  input: z.infer<typeof listSchema>
): Promise<ListR2FilesResult> {
  const validationResult = listSchema.safeParse(input);
  if (!validationResult.success) {
    const formattedErrors = validationResult.error.flatten().fieldErrors;
    return { files: [], error: `Invalid input: ${JSON.stringify(formattedErrors)}` };
  }

  const { categoryPrefix, filterPrefix, continuationToken, pageSize } = validationResult.data;

  if (!process.env.R2_BUCKET_NAME) {
    console.error("R2_BUCKET_NAME environment variable is not set.");
    return { files: [], error: "Server configuration error: R2 bucket name not set." };
  }

  const s3Client = createR2Client();
  const searchPrefix = filterPrefix ? `${categoryPrefix}${filterPrefix}` : categoryPrefix;

  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: searchPrefix,
      MaxKeys: pageSize,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    const files: R2File[] = (response.Contents || []).map((obj: _Object) => ({
      key: obj.Key ?? 'unknown-key',
      size: obj.Size ?? 0,
      type: obj.Key?.split('.').pop() ?? 'unknown-type',
      lastModified: obj.LastModified ?? new Date(0),
    }));

    return {
      files: files,
      nextContinuationToken: response.NextContinuationToken,
    };
  } catch (error: any) {
    console.error("Failed to list files from R2:", error);
    return { files: [], error: `Failed to list files: ${error.message || 'Unknown R2 error'}` };
  }
}

export async function deleteR2File(input: z.infer<typeof deleteSchema>): Promise<DeleteR2FileResult> {
  const validationResult = deleteSchema.safeParse(input);
  if (!validationResult.success) {
    const formattedErrors = validationResult.error.flatten().fieldErrors;
    return { success: false, error: `Invalid input: ${JSON.stringify(formattedErrors)}` };
  }

  const { key } = validationResult.data;

  try {
    await deleteR2Util(key);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete R2 file (${key}):`, error);
    return { success: false, error: error.message || 'Failed to delete file from R2.' };
  }
} 