import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getDomain = (url: string) => {
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const domain = new URL(urlWithProtocol).hostname;
    return domain.replace(/^www\./, '');
  } catch (error) {
    return url;
  }
};

export const formatCurrency = (
  amount: number | null | undefined,
  currency: string | null | undefined
): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "-";
  }
  const effectiveCurrency = currency || "usd";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: effectiveCurrency.toUpperCase(),
    }).format(amount);
  } catch (e) {
    console.error("Error formatting currency:", e);
    return `${amount.toFixed(2)} ${effectiveCurrency.toUpperCase()}`;
  }
};


export const getURL = (path: string = '') => {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000/';
  url = url.includes('http') ? url : `https://${url}`;
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;
  url = `${url}${path}`;
  return url;
}