"use server";

import { db } from "@/db";
import { users as usersSchema } from "@/db/schema";
import { DEFAULT_LOCALE } from "@/i18n/routing";
import { actionResponse } from "@/lib/action-response";
import {
  deleteFile,
  generateR2Key,
  serverUploadFile,
} from "@/lib/cloudflare/r2";
import { getErrorMessage } from "@/lib/error-utils";
import { createClient } from "@/lib/supabase/server";
import {
  AVATAR_ALLOWED_FILE_TYPES,
  AVATAR_MAX_FILE_SIZE,
  FULL_NAME_MAX_LENGTH,
  isValidFullName,
} from "@/lib/validations";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

const MAX_FILE_SIZE = AVATAR_MAX_FILE_SIZE;
const ALLOWED_FILE_TYPES = AVATAR_ALLOWED_FILE_TYPES;

interface UpdateUserSettingsParams {
  formData: FormData;
  locale?: string;
}

export async function updateUserSettingsAction({
  formData,
  locale = DEFAULT_LOCALE,
}: UpdateUserSettingsParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return actionResponse.unauthorized();
    }

    const t = await getTranslations({
      locale,
      namespace: "Settings",
    });

    const fullName = formData.get("fullName") as string;
    const avatar = formData.get("avatar") as File | null;

    if (!fullName || !isValidFullName(fullName.trim()) || fullName.trim().length > FULL_NAME_MAX_LENGTH) {
      return actionResponse.badRequest(t("toast.errorInvalidFullName"));
    }

    let avatarUrl: string | undefined = undefined;

    if (avatar) {
      if (!ALLOWED_FILE_TYPES.includes(avatar.type)) {
        return actionResponse.badRequest(t("toast.errorInvalidFileType"));
      }

      if (avatar.size > MAX_FILE_SIZE) {
        return actionResponse.badRequest(
          t("toast.errorFileSizeExceeded", {
            maxSizeInMB: MAX_FILE_SIZE / 1024 / 1024,
          })
        );
      }

      try {
        const filePath = `avatars/${authUser.id}`;
        const key = generateR2Key({
          fileName: avatar.name,
          path: filePath,
          prefix: "avatar",
        });

        const buffer = Buffer.from(await avatar.arrayBuffer());
        const { url } = await serverUploadFile({
          data: buffer,
          contentType: avatar.type,
          key: key,
        });

        if (authUser.user_metadata?.avatar_url) {
          try {
            const oldAvatarUrl = authUser.user_metadata.avatar_url as string;
            const oldPath = new URL(oldAvatarUrl).pathname.split('/').slice(-3).join('/');

            if (oldPath.startsWith(`avatars/${authUser.id}/`)) {
              await deleteFile(oldPath);
            }
          } catch (error) {
            console.error("Failed to delete old avatar:", error);
          }
        }
        avatarUrl = url;
      } catch (error) {
        console.error("Avatar upload error:", error);
        return actionResponse.error(t("toast.errorUploadAvatar"));
      }
    }

    try {
      await db
        .update(usersSchema)
        .set({
          full_name: fullName.trim(),
          avatar_url: avatarUrl || authUser.user_metadata?.avatar_url || null,
        })
        .where(eq(usersSchema.id, authUser.id));
    } catch (updateUserError) {
      console.error("Update user profile error:", updateUserError);
      return actionResponse.error(t("toast.errorUpdateUserProfile"));
    }

    return actionResponse.success({ message: t("toast.updateSuccessDescription") });
  } catch (error) {
    console.error("Update user settings action error:", error);
    const errorMessage = getErrorMessage(error);
    return actionResponse.error(errorMessage || "An unexpected error occurred.");
  }
} 