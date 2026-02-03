import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

async function getAuthFromCookies(
    request: NextRequest
): Promise<string | null> {
    const access_cookie = request.cookies.get("authToken");
    if (access_cookie) {
        return await access_cookie.value;
    }
    return null;
}

export interface TokenPayload {
    sub: string;
    exp: number;
    type: string;
}

function getUserRoleFromToken(access: string | null) {
    if (!access) {
        return null;
    }

    try {
        const decoded = jwtDecode<TokenPayload>(access);
        return decoded.type;
    } catch {
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const access = await getAuthFromCookies(request);

    const pathname = request.nextUrl.pathname;

    // Skip middleware for /api/v1/ routes (these are external API calls)
    if (pathname.startsWith("/api/v1/")) {
        return NextResponse.next();
    }

    const userRole = await getUserRoleFromToken(access);

    const isAdmin = userRole === "Admin";
    const isMember = userRole === "Member";

    const isAuthRoute = () => pathname.startsWith("/login");
    const isProtectedRoute = () => pathname.startsWith("/control-panel");
    const isAgenciesRoute = () =>
        pathname === "/control-panel/agencies" ||
        pathname === "/control-panel/agencies/" ||
        pathname === "/control-panel/monitoring" ||
        pathname === "/control-panel/monitoring/";
    const isUsersRoute = () =>
        pathname === "/control-panel/users" ||
        pathname === "/control-panel/users/";
    const isControlPanelRootRoute = () =>
        pathname === "/control-panel" || pathname === "/control-panel/";
    const isAgencyFormRoute = () => pathname.startsWith("/agency-form/");
    const isPublicApiRoute = () => pathname.startsWith("/api/public/");
    const isPublicPageRoute = () =>
        pathname === "/privacy-policy" ||
        pathname === "/privacy-policy/" ||
        pathname === "/terms-of-service" ||
        pathname === "/terms-of-service/" ||
        pathname === "/home" ||
        pathname === "/home/";

    const isHomePage = () => pathname === "/" || pathname === "";

    // Allow access to agency form, public API routes, and public pages without authentication
    if (isAgencyFormRoute() || isPublicApiRoute() || isPublicPageRoute()) {
        return NextResponse.next();
    }

    // Handle root path: redirect based on authentication status
    if (isHomePage()) {
        if (access) {
            return NextResponse.redirect(
                new URL("/control-panel", request.url)
            );
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect to login if not authenticated for protected routes
    if (!access && isProtectedRoute()) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect to agencies page if on the control panel root
    // But preserve query parameters (e.g., for OAuth callbacks)
    if (access && isControlPanelRootRoute()) {
        const redirectUrl = new URL("/control-panel/agencies", request.url);
        // Preserve query parameters from the original request
        request.nextUrl.searchParams.forEach((value, key) => {
            redirectUrl.searchParams.set(key, value);
        });
        return NextResponse.redirect(redirectUrl);
    }

    // Members and Admins have same access to all pages except users page
    if (access && isMember && isUsersRoute()) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    // Redirect to agencies for authenticated users on auth routes
    if (access && isAuthRoute()) {
        return NextResponse.redirect(
            new URL("/control-panel/agencies", request.url)
        );
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!.+\\.[\\w]+$|_next).*)",
        "/",
        "/api/:path*", // Match all /api routes
    ],
};
