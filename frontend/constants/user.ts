import { NewUser } from "@/types/user";

export const initialUserState: NewUser = {
    username: "",
    password: "",
    type: "Member",
    enabled: true,
    protected: false,
};

export const userTypeOptions = [
    { value: "Admin", label: "Admin" },
    { value: "Member", label: "Member" },
];
