"use client";

import { useQuery } from "@tanstack/react-query";
import { getAgencies } from "@/services/agencyApi";
import { ComboboxField } from "@/components/ui/data-table/combobox-field";
import { Agency } from "@/types/agency";

interface AgencySelectorProps {
    selectedAgencyId: string;
    onSelectAgency: (agencyId: string) => void;
    label?: string;
    placeholder?: string;
    className?: string;
}

export function AgencySelector({
    selectedAgencyId,
    onSelectAgency,
    label = "Agency",
    placeholder = "Select an agency...",
    className,
}: AgencySelectorProps) {
    const { data: agencies = [], isLoading } = useQuery({
        queryKey: ["agencies"],
        queryFn: getAgencies,
    });

    const agencyOptions = agencies.map((agency: Agency) => ({
        value: agency.id,
        label: agency.name,
    }));

    const handleSelectAgency = (value: string) => {
        onSelectAgency(value);
    };

    return (
        <ComboboxField
            label={label}
            id="agency-selector"
            value={selectedAgencyId}
            options={agencyOptions}
            onChange={handleSelectAgency}
            placeholder={isLoading ? "Loading agencies..." : placeholder}
            searchPlaceholder="Search agencies..."
            emptyMessage={
                isLoading ? "Loading agencies..." : "No agencies found"
            }
            disabled={isLoading}
            className={className}
        />
    );
}
