export type UserType = "Admin" | "Member";

export interface User {
    id: number;
    username: string;
    password: string;
    type: UserType;
    enabled: boolean;
    protected: boolean;
}

export type NewUser = Omit<User, "id">;
