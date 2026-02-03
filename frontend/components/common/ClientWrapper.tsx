"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export function ClientWrapper({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 0, // 0 seconds
                        gcTime: 10 * 60 * 1000, // 10 minutes
                        refetchOnWindowFocus: true,
                        refetchOnMount: true,
                        refetchOnReconnect: true,
                    },
                },
            })
    );

    useEffect(() => {
        // Only run on client side
        if (typeof window !== "undefined") {
            // Create a custom persister that filters out auth queries
            const localStoragePersister = createSyncStoragePersister({
                storage: window.localStorage,
                key: "AGENCY_CONTROL_PANEL_REACT_QUERY_CACHE",
                // Override the default serializer to filter out auth queries
                serialize: (data) => {
                    // Filter out auth queries from the cache before serializing
                    const filteredData = {
                        ...data,
                        clientState: {
                            ...data.clientState,
                            queries: data.clientState.queries.filter(
                                (query) => !query.queryHash.includes('["auth"]')
                            ),
                        },
                    };
                    return JSON.stringify(filteredData);
                },
                deserialize: (cachedString) => {
                    return JSON.parse(cachedString);
                },
            });

            persistQueryClient({
                queryClient,
                persister: localStoragePersister,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
        }
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
