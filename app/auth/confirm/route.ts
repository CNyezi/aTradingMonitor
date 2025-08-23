import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { isValidRedirectUrl } from '@/app/auth/utils';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  let next = searchParams.get('next') || '/'
  next = next == 'null' ? '/' : next

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin

  if (!token_hash || !type) {
    console.error('Missing required parameters')
    return NextResponse.redirect(new URL(`/redirect-error?code=invalid_params`, siteUrl))
  }

  if (!isValidRedirectUrl(next)) {
    console.error('Invalid redirect URL')
    return NextResponse.redirect(new URL(`/redirect-error?code=invalid_redirect`, siteUrl))
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (error) {
      switch (error.message) {
        case 'Token has expired':
          return NextResponse.redirect(new URL(`/redirect-error?code=token_expired`, siteUrl))
        case 'Invalid token':
          return NextResponse.redirect(new URL(`/redirect-error?code=invalid_token`, siteUrl))
        case 'Email link is invalid or has expired':
          return NextResponse.redirect(new URL(`/redirect-error?code=invalid_link_or_expired`, siteUrl))
        default:
          console.error('Auth error:', error)
          return NextResponse.redirect(new URL(`/redirect-error?code=unknown`, siteUrl))
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.redirect(new URL(`/redirect-error?code=server_error`, siteUrl))
  }

  return NextResponse.redirect(new URL(next, siteUrl))
}