"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCookie, deleteCookie } from "cookies-next";

export function CacheCleaner() {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Check for the clearAuthCache cookie
        const clearAuthCache = getCookie("clearAuthCache");

        if (clearAuthCache) {
            // Clear the auth query from the cache
            queryClient.removeQueries({ queryKey: ["auth"] });

            // Remove the cookie
            deleteCookie("clearAuthCache", { path: "/" });

            // For extra safety, clear any localStorage items that might contain auth data
            if (typeof window !== "undefined") {
                // Get the React Query cache key from localStorage
                const cacheKey = "AGENCY_CONTROL_PANEL_REACT_QUERY_CACHE";

                try {
                    // Get the current cache
                    const cacheData = localStorage.getItem(cacheKey);

                    if (cacheData) {
                        // Parse the cache
                        const parsedCache = JSON.parse(cacheData);

                        // Filter out auth queries
                        if (
                            parsedCache &&
                            parsedCache.clientState &&
                            parsedCache.clientState.queries
                        ) {
                            parsedCache.clientState.queries =
                                parsedCache.clientState.queries.filter(
                                    (query: any) =>
                                        !query.queryHash.includes('["auth"]')
                                );

                            // Save the filtered cache back to localStorage
                            localStorage.setItem(
                                cacheKey,
                                JSON.stringify(parsedCache)
                            );
                        }
                    }
                } catch (error) {
                    console.error("Error cleaning cache:", error);
                }
            }
        }
    }, [queryClient]);

    // This component doesn't render anything
    return null;
}
