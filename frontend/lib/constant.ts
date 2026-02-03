const normalizeApiBaseUrl = (url?: string) => {
    // Force HTTPS for production, but keep HTTP for localhost/127.0.0.1
    const fallback = "https://billup.fly.dev/api/v1";
    const value = url?.trim() || fallback;

    // Don't force HTTPS for localhost or 127.0.0.1 (local development)
    const isLocalhost =
        /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(value);

    if (isLocalhost) {
        // Keep the original protocol for localhost
        return value.replace(/\/+$/, "");
    }

    // Force HTTPS for production URLs
    const secure = value.replace(/^http:/i, "https:");
    return secure.replace(/\/+$/, "");
};

export const BASE_API_URL = normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL
);
