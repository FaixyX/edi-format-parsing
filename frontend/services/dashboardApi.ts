"use client";

import { Backend } from "@/lib/helper";

export interface DashboardStats {
    totalAgencies: number;
    totalUsers: number;
    totalMacAddresses: number;
    totalPdfTemplates: number;
    activeUsers?: {
        active: number;
        total: number;
    };
    excelStatus?: string;
}

/**
 * Fetches dashboard statistics from the backend
 * @returns Dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        const { data } = await Backend.get("dashboard/stats", {
            withCredentials: true,
        });

        return data;
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        // Return mock data if the API call fails
        return getMockDashboardStats();
    }
}

/**
 * Mock data for development until the backend endpoint is available
 */
function getMockDashboardStats(): DashboardStats {
    return {
        totalAgencies: 1,
        totalUsers: 5,
        totalMacAddresses: 12,
        totalPdfTemplates: 3,
        activeUsers: {
            active: 2,
            total: 3,
        },
        excelStatus: "Not Uploaded",
    };
}
