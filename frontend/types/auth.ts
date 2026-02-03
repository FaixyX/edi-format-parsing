export type UserType = "Admin" | "Member";

export interface User {
    id: string;
    username: string;
    type: UserType;
}

export interface LoginResponse {
    success: boolean;
    error?: string;
    token?: string;
    redirectUrl?: string;
    user?: {
        id: string;
        username: string;
        type: string;
    };
}

export interface LoginCredentials {
    username: string;
    password: string;
    keepLoggedIn: boolean;
}
