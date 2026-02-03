export interface Agency {
    id: string; // UUID string
    name: string;
    link: string;
    username: string;
    password: string;
    npi: string | null;
}

export type NewAgency = Omit<Agency, "id">;
