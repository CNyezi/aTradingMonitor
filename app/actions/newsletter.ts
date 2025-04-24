import { NewsletterWelcomeEmail } from '@/emails/newsletter-welcome';
import { normalizeEmail, validateEmail } from '@/lib/email';
import { resend } from '@/lib/resend';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';

const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID!;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const REDIS_RATE_LIMIT_KEY = process.env.UPSTASH_REDIS_NEWSLETTER_RATE_LIMIT_KEY || 'newsletter_rate_limit';
const DAY_MAX_SUBMISSIONS = parseInt(process.env.DAY_MAX_SUBMISSIONS || '10');

const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DAY_MAX_SUBMISSIONS, '1d'),
  prefix: REDIS_RATE_LIMIT_KEY,
});

async function checkRateLimit(locale: string) {

  const t = await getTranslations({ locale, namespace: 'Footer.Newsletter' });

  const headersList = await headers();
  const ip = headersList.get('x-real-ip') ||
    headersList.get('x-forwarded-for') ||
    'unknown';

  const { success } = await limiter.limit(ip);
  if (!success) {
    throw new Error(t('subscribe.multipleSubmissions'));
  }
}

export async function subscribeToNewsletter(email: string, locale = 'en') {
  try {
    await checkRateLimit(locale);

    const t = await getTranslations({ locale, namespace: 'Footer.Newsletter' });

    const normalizedEmail = normalizeEmail(email);
    const { isValid, error } = validateEmail(normalizedEmail);

    if (!isValid) {
      throw new Error(error || t('subscribe.invalidEmail'));
    }

    await resend.contacts.create({
      audienceId: AUDIENCE_ID,
      email: normalizedEmail
    });

    const unsubscribeToken = Buffer.from(normalizedEmail).toString('base64');
    const unsubscribeLinkEN = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe/newsletter?token=${unsubscribeToken}`;
    const unsubscribeLinkZH = `${process.env.NEXT_PUBLIC_SITE_URL}/zh/unsubscribe/newsletter?token=${unsubscribeToken}`;
    const unsubscribeLinkJA = `${process.env.NEXT_PUBLIC_SITE_URL}/ja/unsubscribe/newsletter?token=${unsubscribeToken}`;
    const unsubscribeLink = locale === 'zh' ? unsubscribeLinkZH : locale === 'ja' ? unsubscribeLinkJA : unsubscribeLinkEN;

    await resend.emails.send({
      from: `${process.env.ADMIN_NAME} <${process.env.ADMIN_EMAIL}>`,
      to: normalizedEmail,
      subject: t('subscribe.emailSubject'),
      react: await NewsletterWelcomeEmail({
        email: normalizedEmail,
        unsubscribeLinkEN,
        unsubscribeLinkZH,
        unsubscribeLinkJA,
        locale: locale as 'en' | 'zh' | 'ja'
      }),
      headers: {
        "List-Unsubscribe": `<${unsubscribeLink}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    });

    return { success: true };
  } catch (error) {
    console.error('failed to subscribe to newsletter:', error);
    throw error;
  }
}

export async function unsubscribeFromNewsletter(token: string, locale = 'en') {
  try {
    await checkRateLimit(locale);
    const t = await getTranslations({ locale, namespace: 'Footer.Newsletter' });

    const email = Buffer.from(token, 'base64').toString();
    const normalizedEmail = normalizeEmail(email);
    const { isValid, error } = validateEmail(normalizedEmail);

    if (!isValid) {
      throw new Error(error || t('unsubscribe.invalidEmail'));
    }

    // check if user exists in audience
    const list = await resend.contacts.list({ audienceId: AUDIENCE_ID });
    const user = list.data?.data.find((item) => item.email === normalizedEmail);

    if (!user) {
      throw new Error(t('unsubscribe.notInNewsletter'));
    }

    // remove from audience
    await resend.contacts.remove({
      audienceId: AUDIENCE_ID,
      email: normalizedEmail,
    });

    return { success: true, email: normalizedEmail };
  } catch (error) {
    console.error('failed to unsubscribe from newsletter:', error);
    throw error;
  }
}
