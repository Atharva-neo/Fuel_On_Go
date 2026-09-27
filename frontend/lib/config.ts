const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL must be configured for this build');
}

export const API_BASE_URL = apiUrl.replace(/\/+$/, '');
