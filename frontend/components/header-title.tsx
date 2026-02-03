"use client";
import { useAuth } from "@/context/auth-context";
import { usePathname } from "next/navigation";

const menuItems: { id: string; label: string; href: string }[] = [
    { id: "agencies", label: "Agencies", href: "/control-panel/agencies" },
    { id: "users", label: "Users", href: "/control-panel/users" },
    // 837 Files
    { id: "837-monitoring", label: "Dashboard", href: "/control-panel/837-files/monitoring" },
    { id: "837-billing", label: "Upload EOB", href: "/control-panel/837-files/billing-files" },
    // 277 Files
    { id: "277-monitoring", label: "Dashboard", href: "/control-panel/277-files/monitoring" },
    { id: "277-billing", label: "Upload EOB", href: "/control-panel/277-files/billing-files" },
];

export function HeaderTitle() {
    const pathname = usePathname();
    const { type } = useAuth();

    const items = [
        ...menuItems,
        ...(type?.toLocaleLowerCase() === "admin" ? [] : []),
    ];

    const getTitle = () => {
        if (!pathname) return "Control Panel";

        const exact = items.find((item) => item.href === pathname);
        if (exact) return exact.label;

        const parent = items.find(
            (item) =>
                pathname.startsWith(item.href) && item.href !== "/control-panel"
        );
        if (parent) return parent.label;

        return "Control Panel";
    };

    return <h2 className="text-lg font-medium ml-2">{getTitle()}</h2>;
}
