import { subscribeToNewsletter } from '@/app/actions/newsletter';
import { apiResponse } from '@/lib/api-response';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';

export async function POST(request: Request,
  { params }: { params: Promise<{ locale: string }> }) {

  const { get } = await headers();
  const locale = get("Accept-Language");
  const t = await getTranslations({ locale: locale || "en", namespace: 'Footer.Newsletter' });

  try {
    const { email } = await request.json();

    if (!email) {
      return apiResponse.badRequest(t('subscribe.invalidEmail'));
    }

    const result = await subscribeToNewsletter(email, locale || "en");
    return apiResponse.success(result);
  } catch (error) {
    console.error("Newsletter subscription failed:", error);
    const message = error instanceof Error ? error.message : 'Server processing request failed';
    return apiResponse.error(
      message,
      error instanceof Error ? 400 : 500
    );
  }
} 