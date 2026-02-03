"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Users,
    LogOut,
    Building2,
    Settings,
    FileText,
    Activity,
    ChevronDown,
    ChevronRight,
    LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./common/theme-toggle";
import { logout } from "@/actions/logout";
import { removeToken } from "@/lib/auth";
import {
    Sidebar as ShadcnSidebar,
    SidebarContent,
    SidebarHeader,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarRail,
} from "@/components/ui/sidebar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/context/auth-context";
import { useMemo, useState, useEffect } from "react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { type } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Build menu structure: 837 Files and 277 Files groups with Dashboard + Upload EOB
    const menuSections = useMemo(() => {
        const formatGroupItems = [
            { id: "monitoring", label: "Dashboard", pathSegment: "monitoring", icon: Activity },
            { id: "billing-files", label: "Upload EOB", pathSegment: "billing-files", icon: FileText },
        ];

        const formatGroups = [
            { id: "837-files", label: "837 Files", pathPrefix: "/control-panel/837-files", items: formatGroupItems },
            { id: "277-files", label: "277 Files", pathPrefix: "/control-panel/277-files", items: formatGroupItems },
        ];

        const adminItems = [
            {
                id: "users",
                label: "Users",
                href: "/control-panel/users",
                icon: Users,
                showFor: ["Admin"],
            },
        ];

        const agenciesItem = {
            id: "agencies",
            label: "Agencies",
            href: "/control-panel/agencies",
            icon: Building2,
            showFor: ["Admin", "Member"],
        };

        return {
            formatGroups,
            adminItems,
            agenciesItem,
        };
    }, []);

    // Sidebar is shown for both Admin and Member

    const handleLogout = async () => {
        try {
            // Client-side cookie cleanup
            removeToken();

            // Server-side logout action
            const result = await logout();

            if (result?.redirect) {
                // Use window.location for a hard refresh to ensure all state is cleared
                window.location.href = result.redirect;
            } else {
                // Fallback to router.push
                router.push("/login");
            }

            toast.success("Logout successful");
        } catch (error) {
            console.error("Logout error:", error);
            toast.error("Logout failed");
        }
    };

    const filteredAdminItems = menuSections.adminItems.filter((item) =>
        item.showFor.includes(type as string)
    );
    const showAgencies = menuSections.agenciesItem.showFor.includes(type as string);

    // Default open the format group that contains the current path
    const defaultOpenFormat = useMemo(() => {
        if (pathname.startsWith("/control-panel/837-files")) return "837-files";
        if (pathname.startsWith("/control-panel/277-files")) return "277-files";
        return "837-files";
    }, [pathname]);

    const [openFormatGroup, setOpenFormatGroup] = useState<string>(defaultOpenFormat);
    useEffect(() => {
        setOpenFormatGroup(defaultOpenFormat);
    }, [defaultOpenFormat]);

    return (
        <ShadcnSidebar>
            <SidebarHeader className="p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary">MATEVOSYAN INC</h1>
                </div>
            </SidebarHeader>
            <SidebarContent className="px-2">
                <SidebarMenu>
                    {/* Format 1 and Format 2 groups (Admin and Member) */}
                    {menuSections.formatGroups.map((group) => {
                        const isFormatActive = pathname.startsWith(group.pathPrefix);
                        const isOpen = openFormatGroup === group.id;
                        return (
                            <SidebarMenuItem key={group.id}>
                                <Collapsible
                                    open={openFormatGroup === group.id}
                                    onOpenChange={(open) => open && setOpenFormatGroup(group.id)}
                                    className="group/collapsible"
                                >
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton
                                            size="lg"
                                            isActive={isFormatActive}
                                            className={cn(
                                                "w-full justify-between",
                                                "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=false]:hover:bg-secondary/20 data-[active=false]:hover:text-muted-foreground"
                                            )}
                                        >
                                            <span className="flex items-center gap-3">
                                                <LayoutList className="h-5 w-5 shrink-0" />
                                                <span>{group.label}</span>
                                            </span>
                                            {isOpen ? (
                                                <ChevronDown className="h-4 w-4 shrink-0" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 shrink-0" />
                                            )}
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {group.items.map((item) => {
                                                const Icon = item.icon;
                                                const href = `${group.pathPrefix}/${item.pathSegment}`;
                                                const isActive = pathname === href;
                                                return (
                                                    <SidebarMenuSubItem key={`${group.id}-${item.id}`}>
                                                        <SidebarMenuSubButton
                                                            asChild
                                                            isActive={isActive}
                                                        >
                                                            <Link href={href} prefetch={true}>
                                                                <Icon className="h-4 w-4" />
                                                                <span>{item.label}</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                );
                                            })}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarMenuItem>
                        );
                    })}

                    {/* Admin-only items */}
                    {filteredAdminItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <SidebarMenuItem key={item.id}>
                                <SidebarMenuButton
                                    size="lg"
                                    asChild
                                    isActive={isActive}
                                    className={cn(
                                        "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=false]:hover:bg-secondary/20 data-[active=false]:hover:text-muted-foreground"
                                    )}
                                >
                                    <Link href={item.href} prefetch={true}>
                                        <Icon className="mr-3 h-5 w-5" />
                                        <span>{item.label}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}

                    {/* Agencies item at the bottom */}
                    {showAgencies && (() => {
                        const Icon = menuSections.agenciesItem.icon;
                        const isActive = pathname === menuSections.agenciesItem.href;
                        return (
                            <SidebarMenuItem key={menuSections.agenciesItem.id}>
                                <SidebarMenuButton
                                    size="lg"
                                    asChild
                                    isActive={isActive}
                                    className={cn(
                                        "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=false]:hover:bg-secondary/20 data-[active=false]:hover:text-muted-foreground"
                                    )}
                                >
                                    <Link href={menuSections.agenciesItem.href} prefetch={true}>
                                        <Icon className="mr-3 h-5 w-5" />
                                        <span>{menuSections.agenciesItem.label}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })()}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        {type === "Admin" && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsSettingsOpen(true)}
                                title="System Settings"
                            >
                                <Settings />
                            </Button>
                        )}
                    </div>
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={handleLogout}
                        className="h-9 w-9"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </SidebarFooter>
            <SidebarRail />

            {/* Settings Dialog */}
            <SettingsDialog
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </ShadcnSidebar>
    );
}
