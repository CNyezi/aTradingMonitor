import { unsubscribeFromNewsletter } from "@/app/actions/newsletter";
import { Link as I18nLink } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";

import { getLocale, getTranslations } from "next-intl/server";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Page(props: { searchParams: SearchParams }) {
  const t = await getTranslations("Footer.Newsletter");
  const currentLocale = await getLocale();

  let status: "error" | "success" = "error";
  let email = "";
  let errorMessage = t("unsubscribe.errorGeneric");

  const searchParams = await props.searchParams;
  const token = searchParams.token as string;

  if (!token) {
    errorMessage = t("unsubscribe.errorNoToken");
  } else {
    try {
      const result = await unsubscribeFromNewsletter(token, currentLocale);
      if (result.success) {
        status = "success";
        email = result.email;
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : errorMessage;
    }
  }

  return (
    <div className="max-w-md mx-auto my-16 p-6 dark:bg-gray-900 bg-white rounded-lg shadow-md transition-colors duration-300">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">
        {t("unsubscribe.title")}
      </h1>

      {status === "success" ? (
        <div className="space-y-4">
          <div className="bg-green-100 dark:bg-green-900 p-4 rounded-md">
            <p className="text-green-800 dark:text-green-300 font-medium">
              {t("unsubscribe.success")}
            </p>
          </div>

          <p className="text-sm dark:text-gray-400 text-gray-600">
            {t("unsubscribe.emailPrefix")} {email}
          </p>

          <p className="dark:text-gray-300">{t("unsubscribe.regretMessage")}</p>

          <div className="pt-4 mt-6 border-t dark:border-gray-700 border-gray-200">
            <p className="text-sm dark:text-gray-400 text-gray-500">
              {t("unsubscribe.contactPrefixSuccess")}
              <a
                href={`mailto:${process.env.ADMIN_EMAIL}`}
                className="text-blue-600 dark:text-blue-400 ml-1 hover:underline"
                target="_blank"
              >
                {process.env.ADMIN_EMAIL}
              </a>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-md">
            <p className="text-red-800 dark:text-red-300 font-medium">
              {errorMessage}
            </p>
          </div>

          <p className="dark:text-gray-300">{t("unsubscribe.errorMessage")}</p>

          <div className="pt-4 mt-6 border-t dark:border-gray-700 border-gray-200">
            <p className="text-sm dark:text-gray-400 text-gray-500">
              {t("unsubscribe.contactPrefix")}
              <I18nLink
                href={`mailto:${process.env.ADMIN_EMAIL}`}
                title={process.env.ADMIN_EMAIL}
                prefetch={false}
                className="text-blue-600 dark:text-blue-400 ml-1 hover:underline"
              >
                {process.env.ADMIN_EMAIL}
              </I18nLink>
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <I18nLink
          href="/"
          title={t("unsubscribe.backToHome")}
          prefetch={true}
          className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {t("unsubscribe.backToHome")}
        </I18nLink>
      </div>
    </div>
  );
}
