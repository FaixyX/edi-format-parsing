import { myFetch } from "./api";
import { removeToken } from "./auth";

const debugLogging =
    process.env.NEXT_PUBLIC_DEBUG_LOGGING === "true" ||
    process.env.NODE_ENV === "development";

// Global function to handle 401 errors (token invalidated)
function handleUnauthorized() {
    removeToken();
    // Redirect to login page
    if (typeof window !== "undefined") {
        window.location.href = "/login";
    }
}

interface BackendResponse {
    data?: any;
    status: number;
}

interface GetFetchOptions {
    withCredentials?: boolean;
    headers?: HeadersInit;
    tags?: string[];
    timeout?: number; // Add timeout option
}

interface PostFetchOptions {
    content_type?: string;
    withCredentials?: boolean;
    headers?: HeadersInit;
    tags?: string[];
    body?: any;
    timeout?: number; // Add timeout option
}

export class Backend {
    static async get(
        endpoint: string,
        options: GetFetchOptions
    ): Promise<BackendResponse> {
        const response = await myFetch("GET", endpoint, {
            withCredentials: options.withCredentials,
            headers: options.headers,
            tags: options.tags,
            timeout: options.timeout,
        });

        if (!response.ok) {
            // Handle 401 Unauthorized - token invalidated
            if (response.status === 401) {
                handleUnauthorized();
                const errorText = await response.text();
                const errorData = safeParseJson(errorText);
                const error = new Error(
                    errorData.detail ||
                        errorData.error ||
                        "Token has been invalidated. Please log in again."
                );
                (error as any).status = response.status;
                (error as any).data = errorData;
                throw error;
            }

            const errorText = await response.text();
            const errorData = safeParseJson(errorText);
            const error = new Error(
                errorData.detail ||
                    errorData.error ||
                    `HTTP ${response.status}: ${response.statusText}`
            );
            (error as any).status = response.status;
            (error as any).data = errorData;
            throw error;
        }

        const data = await response.json();
        if (debugLogging) {
            console.debug(`[Backend.get] ${endpoint} -> ${response.status}`);
        }

        return {
            data: data,
            status: response.status,
        };
    }

    static async post(
        endpoint: string,
        options: PostFetchOptions
    ): Promise<BackendResponse> {
        const response = await myFetch("POST", endpoint, {
            withCredentials: options.withCredentials,
            headers: {
                ...options.headers,
            },
            tags: options.tags,
            body: options.body,
            timeout: options.timeout,
        });

        if (!response.ok) {
            const errorText = await response.text();
            const errorData = safeParseJson(errorText);

            const error = new Error(
                errorData.detail ||
                    errorData.error ||
                    `HTTP ${response.status}: ${response.statusText}`
            );
            (error as any).status = response.status;
            (error as any).data = errorData;
            throw error;
        }

        const data = await response.json();
        if (debugLogging) {
            console.debug(`[Backend.post] ${endpoint} -> ${response.status}`);
        }

        return {
            data: data,
            status: response.status,
        };
    }

    static async put(
        endpoint: string,
        options: PostFetchOptions
    ): Promise<BackendResponse> {
        const response = await myFetch("PUT", endpoint, {
            withCredentials: options.withCredentials,
            headers: {
                ...options.headers,
            },
            tags: options.tags,
            body: options.body,
            timeout: options.timeout,
        });

        if (!response.ok) {
            const errorText = await response.text();
            const errorData = safeParseJson(errorText);

            const error = new Error(
                errorData.detail ||
                    errorData.error ||
                    `HTTP ${response.status}: ${response.statusText}`
            );
            (error as any).status = response.status;
            (error as any).data = errorData;
            throw error;
        }

        const data = await response.json();
        if (debugLogging) {
            console.debug(`[Backend.put] ${endpoint} -> ${response.status}`);
        }

        return {
            data: data,
            status: response.status,
        };
    }

    static async patch(
        endpoint: string,
        data: any,
        options: PostFetchOptions
    ): Promise<BackendResponse> {
        const response = await myFetch("PATCH", endpoint, {
            withCredentials: options.withCredentials,
            headers: {
                ...options.headers,
            },
            tags: options.tags,
            body: data,
            timeout: options.timeout,
        });

        if (!response.ok) {
            const errorText = await response.text();
            const errorData = safeParseJson(errorText);

            const error = new Error(
                errorData.detail ||
                    errorData.error ||
                    `HTTP ${response.status}: ${response.statusText}`
            );
            (error as any).status = response.status;
            (error as any).data = errorData;
            throw error;
        }

        const responseData = await response.json();
        if (debugLogging) {
            console.debug(`[Backend.patch] ${endpoint} -> ${response.status}`);
        }

        return {
            data: responseData,
            status: response.status,
        };
    }

    static async delete(
        endpoint: string,
        options: PostFetchOptions
    ): Promise<BackendResponse> {
        const fetchOptions: any = {
            withCredentials: options.withCredentials,
            headers: {
                "Content-Type": options.content_type || "application/json",
                ...options.headers,
            },
            tags: options.tags,
            timeout: options.timeout,
        };

        const response = await myFetch("DELETE", endpoint, fetchOptions);

        if (!response.ok) {
            // Handle 401 Unauthorized - token invalidated
            if (response.status === 401) {
                handleUnauthorized();
                const errorText = await response.text();
                const errorData = safeParseJson(errorText);
                const error = new Error(
                    errorData.detail ||
                        errorData.error ||
                        "Token has been invalidated. Please log in again."
                );
                (error as any).status = response.status;
                (error as any).data = errorData;
                throw error;
            }

            const errorText = await response.text();
            const errorData = safeParseJson(errorText);

            const error = new Error(
                errorData.detail ||
                    errorData.error ||
                    `HTTP ${response.status}: ${response.statusText}`
            );
            (error as any).status = response.status;
            (error as any).data = errorData;
            throw error;
        }

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (debugLogging) {
            console.debug(`[Backend.delete] ${endpoint} -> ${response.status}`);
        }

        return {
            data,
            status: response.status,
        };
    }
}

function safeParseJson(text: string): Record<string, any> {
    try {
        return JSON.parse(text);
    } catch {
        return { detail: text };
    }
}
