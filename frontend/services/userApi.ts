"use client";

import { Backend } from "@/lib/helper";
import { User } from "@/types/user";
import { NewUser } from "@/types/user";
import { UserType } from "@/types/user";

export async function getUsers(): Promise<User[]> {
    const { data } = await Backend.get("users", {
        withCredentials: true,
    });

    return data;
}

export async function getUsersByType(type: UserType): Promise<User[]> {
    const { data } = await Backend.get(`users/by-type/${type}`, {
        withCredentials: true,
    });

    return data;
}

export async function addUser(user: NewUser): Promise<User> {
    try {
        const { data } = await Backend.post("users/", {
            withCredentials: true,
            body: user,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export async function updateUser(
    id: string,
    user: Partial<NewUser>
): Promise<User> {
    const { data } = await Backend.put(`users/${id}`, {
        withCredentials: true,
        body: user,
    });

    return data;
}

export async function deleteUser(id: string): Promise<void> {
    try {
        const { data } = await Backend.delete(`users/${id}`, {
            withCredentials: true,
        });

        if (data && data.detail) {
            throw new Error(data.detail);
        }
    } catch (error) {
        throw error;
    }
}

export async function toggleUserStatus(
    id: string,
    enabled: boolean
): Promise<void> {
    try {
        const { data } = await Backend.patch(
            `users/${id}/toggle`,
            { enabled },
            {
                withCredentials: true,
            }
        );

        if (data.detail) {
            throw new Error(data.detail);
        }
    } catch (error) {
        throw error;
    }
}
