import { z } from "zod";

export const loginSchema = z.object({
    username: z
        .string()
        .min(2, { message: "Username must be at least 2 characters long." }),
    password: z
        .string()
        .min(5, { message: "Password must be at least 5 characters long." }),
    keepLoggedIn: z.boolean().default(false),
});