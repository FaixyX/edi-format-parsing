import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { VisibilityState } from "@tanstack/react-table";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Loads saved column visibility state from localStorage
 */
export function loadTableVisibility(tableId: string): VisibilityState {
    if (typeof window === "undefined") return {};

    try {
        const saved = localStorage.getItem(`table-visibility-${tableId}`);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error(
            `Error loading saved column visibility for ${tableId}:`,
            e
        );
    }

    return {};
}

/**
 * Saves column visibility state to localStorage
 */
export function saveTableVisibility(
    tableId: string,
    state: VisibilityState
): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(
            `table-visibility-${tableId}`,
            JSON.stringify(state)
        );
    } catch (e) {
        console.error(`Error saving column visibility for ${tableId}:`, e);
    }
}
