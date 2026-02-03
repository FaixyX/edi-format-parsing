"use client";

import { Backend } from "@/lib/helper";
import { Agency, NewAgency } from "@/types/agency";

export async function getAgencies(): Promise<Agency[]> {
    const { data } = await Backend.get("agencies", {
        withCredentials: true,
    });

    return data;
}

export async function addAgency(agency: NewAgency): Promise<Agency> {
    try {
        const { data } = await Backend.post("agencies/", {
            withCredentials: true,
            body: agency,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export async function updateAgency(agency: Agency): Promise<Agency> {
    try {
        const { data } = await Backend.put(`agencies/${agency.id}`, {
            withCredentials: true,
            body: agency,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export async function deleteAgency(id: string): Promise<void> {
    await Backend.delete(`agencies/${id}`, {
        withCredentials: true,
    });
}
