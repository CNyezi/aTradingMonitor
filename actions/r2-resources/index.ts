"use server";

import { actionResponse } from "@/lib/action-response";
import { createR2Client, deleteFile as deleteR2Util, ListedObject, listR2Objects } from "@/lib/cloudflare/r2";
import { getErrorMessage } from "@/lib/error-utils";
import { isAdmin } from "@/lib/supabase/isAdmin";
import { createClient } from "@/lib/supabase/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

export type R2File = ListedObject;

export interface ListR2FilesData {
  success: boolean;
  data?: {
    files: R2File[];
    nextContinuationToken?: string;
  };
  error?: string;
}

const listSchema = z.object({
  categoryPrefix: z.string(),
  filterPrefix: z.string().optional(),
  continuationToken: z.string().optional(),
  pageSize: z.number().int().positive().max(100).default(20),
});

export async function listR2Files(
  input: z.infer<typeof listSchema>
): Promise<ListR2FilesData> {
  if (!(await isAdmin())) {
    return actionResponse.forbidden("Admin privileges required.");
  }

  const validationResult = listSchema.safeParse(input);
  if (!validationResult.success) {
    const formattedErrors = validationResult.error.flatten().fieldErrors;
    return actionResponse.badRequest(`Invalid input: ${JSON.stringify(formattedErrors)}`);
  }

  const { categoryPrefix, filterPrefix, continuationToken, pageSize } = validationResult.data;

  const searchPrefix = filterPrefix ? `${categoryPrefix}${filterPrefix}` : categoryPrefix;

  try {
    const result = await listR2Objects({
      prefix: searchPrefix,
      continuationToken: continuationToken,
      pageSize: pageSize,
    });

    if (result.error) {
      return actionResponse.error(result.error);
    }

    return actionResponse.success({
      files: result.objects,
      nextContinuationToken: result.nextContinuationToken,
    });
  } catch (error: any) {
    console.error("Failed to list files using generic R2 lister:", error);
    return actionResponse.error(`Failed to list files: ${error.message || 'Unknown error'}`);
  }
}

export interface DeleteR2FileData {
  success: boolean;
  error?: string;
}

const deleteSchema = z.object({
  key: z.string().min(1, "File key cannot be empty"),
});

export async function deleteR2File(input: z.infer<typeof deleteSchema>): Promise<DeleteR2FileData> {
  if (!(await isAdmin())) {
    return actionResponse.forbidden("Admin privileges required.");
  }

  const validationResult = deleteSchema.safeParse(input);
  if (!validationResult.success) {
    const formattedErrors = validationResult.error.flatten().fieldErrors;
    return actionResponse.badRequest(`Invalid input: ${JSON.stringify(formattedErrors)}`);
  }

  const { key } = validationResult.data;

  try {
    await deleteR2Util(key);
    return actionResponse.success();
  } catch (error: any) {
    console.error(`Failed to delete R2 file (${key}):`, error);
    return actionResponse.error(error.message || 'Failed to delete file from R2.');
  }
}

export interface GeneratePresignedUploadUrlData {
  success: boolean;
  data?: {
    presignedUrl: string;
    key: string;
    publicObjectUrl: string;
  };
  error?: string;
}
const generatePresignedUrlSchema = z.object({
  fileName: z.string().min(1, "File name cannot be empty"),
  contentType: z.string().min(1, "Content type cannot be empty"),
  prefix: z.string().optional(),
  path: z.string(),
});
type GeneratePresignedUploadUrlInput = z.infer<
  typeof generatePresignedUrlSchema
>;

export async function generatePresignedUploadUrl(
  input: GeneratePresignedUploadUrlInput
): Promise<GeneratePresignedUploadUrlData> {
  const validationResult = generatePresignedUrlSchema.safeParse(input);
  if (!validationResult.success) {
    const formattedErrors = validationResult.error.flatten().fieldErrors;
    return actionResponse.badRequest(
      `Invalid input: ${JSON.stringify(formattedErrors)}`
    );
  }

  const { fileName, contentType, path, prefix } = validationResult.data;

  if (!process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
    console.error("R2 configuration is missing (bucket name or public URL).");
    return actionResponse.error("Server configuration error: R2 settings are incomplete.");
  }

  const originalFileExtension = fileName.split(".").pop();
  const uniqueTimestampRandomPart = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}${originalFileExtension ? `.${originalFileExtension}` : ""}`;

  const finalFileName = prefix ? `${prefix}-${uniqueTimestampRandomPart}` : uniqueTimestampRandomPart;
  const cleanedPath = path.replace(/^\/+|\/+$/g, "");
  const objectKey = cleanedPath ? `${cleanedPath}/${finalFileName}` : finalFileName;

  const s3Client = createR2Client();

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: contentType,
  });

  try {
    // @ts-ignore
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 600,
    });

    const publicObjectUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}`;

    return actionResponse.success({
      presignedUrl,
      key: objectKey,
      publicObjectUrl,
    });
  } catch (error: any) {
    console.error(`Failed to generate pre-signed URL for ${objectKey}:`, error);
    return actionResponse.error(getErrorMessage(error) || "Failed to generate pre-signed URL");
  }
}

export async function generateAdminPresignedUploadUrl(
  input: GeneratePresignedUploadUrlInput
): Promise<GeneratePresignedUploadUrlData> {
  if (!(await isAdmin())) {
    return actionResponse.forbidden("Admin privileges required.");
  }
  return generatePresignedUploadUrl(input);
}

export async function generateUserPresignedUploadUrl(
  input: GeneratePresignedUploadUrlInput
): Promise<GeneratePresignedUploadUrlData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return actionResponse.unauthorized();
  }

  const userPath = `/users/${input.path}/userid-${user.id}`;

  return generatePresignedUploadUrl({ ...input, path: userPath });
}