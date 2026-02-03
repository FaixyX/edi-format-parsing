import { getAuthToken } from "@/lib/auth";
import { BASE_API_URL } from "./constant";

const debugLogging =
    process.env.NEXT_PUBLIC_DEBUG_LOGGING === "true" ||
    process.env.NODE_ENV === "development";

interface FetchOptions {
    body?: any;
    withCredentials?: boolean;
    headers?: HeadersInit;
    tags?: string[];
    revalidateTag?: string;
    timeout?: number; // Add timeout option
}

export async function myFetch(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    endpoint: string,
    options: FetchOptions
) {
    // Read token via client-safe helper; login action sets a non-HTTPOnly cookie
    const accessToken = getAuthToken();

    const sanitizedEndpoint = endpoint.replace(/^\/+|\/+$/g, "");
    const resolvedBaseUrl = BASE_API_URL;
    const url = `${resolvedBaseUrl}/${sanitizedEndpoint}`;

    let body: BodyInit | null = null;
    const headers: Record<string, string> = {
        ...(options.withCredentials &&
            accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...(options.headers as Record<string, string>),
    };

    if (options.body) {
        if (options.body instanceof FormData) {
            body = options.body;
        } else {
            body = JSON.stringify(options.body);
            headers["Content-Type"] = "application/json";
        }
    }

    // Create fetch options with timeout
    const fetchOptions: RequestInit = {
        method,
        headers,
        body,
        cache: "no-store",
        credentials: options.withCredentials ? "include" : "omit",
        next: {
            tags: options.tags,
        },
    };

    // Add timeout if specified (default to 5 minutes for expensive operations)
    const timeout = options.timeout || 300000; // 5 minutes default

    if (timeout > 0) {
        fetchOptions.signal = AbortSignal.timeout(timeout);
    }

    try {
        if (debugLogging) {
            console.info("[myFetch] request", {
                method,
                baseUrl: resolvedBaseUrl,
                endpoint,
                sanitizedEndpoint,
                url,
                withCredentials: options.withCredentials,
                origin:
                    typeof window !== "undefined"
                        ? window.location.origin
                        : "server",
            });
        }

        const response = await fetch(url, fetchOptions);
        if (debugLogging) {
            console.debug(
                `[myFetch] ${method} ${sanitizedEndpoint} -> ${response.status}`
            );
        }
        return response;
    } catch (error) {
        if (debugLogging) {
            console.error(
                `[myFetch] ${method} ${endpoint} failed:`,
                error instanceof Error ? error.message : "unknown error"
            );
        }
        throw error;
    }
}
