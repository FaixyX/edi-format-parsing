export interface MacAddress {
    id: string;
    address: string;
    device_name: string;
    authorized_at: string;
    enabled: boolean;
}

export type NewMacAddress = Omit<MacAddress, "id" | "authorized_at">;
