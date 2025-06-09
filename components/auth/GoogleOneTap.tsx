"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

interface CredentialResponse {
  credential: string;
}

const GoogleOneTap = () => {
  const supabase = createClient();
  const router = useRouter();

  const generateNonce = async (): Promise<string[]> => {
    const nonce = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
    );
    const encoder = new TextEncoder();
    const encodedNonce = encoder.encode(nonce);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encodedNonce);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return [nonce, hashedNonce];
  };

  useEffect(() => {
    const setupGoogleOneTap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          return;
        }

        if (!window.google) {
          console.error("Google GSI script not loaded.");
          return;
        }

        const [nonce, hashedNonce] = await generateNonce();

        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: async (response: CredentialResponse) => {
            try {
              const { error } = await supabase.auth.signInWithIdToken({
                provider: "google",
                token: response.credential,
                nonce,
              });

              if (error) throw error;

              router.refresh();
            } catch (error) {
              console.error("Error in One Tap callback:", error);
            }
          },
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
        });

        window.google.accounts.id.prompt();
      } catch (error) {
        console.error("Error setting up Google One Tap:", error);
      }
    };

    setupGoogleOneTap();

    return () => {
      if (window.google) {
        window.google.accounts.id.cancel();
      }
    };
  }, [router, supabase]);

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
    />
  );
};

export default GoogleOneTap;
