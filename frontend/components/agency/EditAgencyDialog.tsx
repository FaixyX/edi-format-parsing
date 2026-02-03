"use client";

import { Agency } from "@/types/agency";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";
import { PasswordField } from "@/components/ui/data-table/password-field";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAgencySchema, AgencyFormValues } from "@/schema/agency-schema";
import { Form } from "@/components/ui/form";
import { useEffect, useMemo } from "react";

interface EditAgencyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AgencyFormValues) => void;
    isSubmitting: boolean;
    agency: Agency | null;
    existingAgencies: Agency[];
    showSensitiveData?: boolean;
}

export function EditAgencyDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    agency,
    existingAgencies,
    showSensitiveData = true,
}: EditAgencyDialogProps) {
    // Create schema with current agencies list, excluding the current agency
    // This ensures validation always uses the latest agencies data and excludes the current agency
    const schema = useMemo(
        () => createAgencySchema(existingAgencies, agency?.id),
        [existingAgencies, agency?.id]
    );

    const form = useForm<AgencyFormValues>({
        resolver: zodResolver(schema),
        mode: "onChange", // Validate on change for real-time feedback
        defaultValues: {
            name: "",
            link: "",
            npi: "",
            username: "",
            password: "",
        },
    });

    // Reset form when dialog opens or agency changes
    useEffect(() => {
        if (isOpen && agency) {
            form.reset({
                name: agency.name,
                link: agency.link,
                npi: agency.npi || "",
                username: agency.username,
                password: agency.password,
            });
            form.clearErrors();
        }
    }, [isOpen, agency, form]);

    const handleSubmit = (data: AgencyFormValues) => {
        onSubmit(data);
    };

    if (!agency) return null;

    const formId = "edit-agency-form";

    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={() => {
                form.handleSubmit(handleSubmit)();
            }}
            title="Edit Agency"
            isSubmitting={isSubmitting}
            submitText="Update Agency"
            loadingText="Updating..."
        >
            <Form {...form}>
                <form
                    id={formId}
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-4"
                >
                    <FormField useFormControl label="NPI" id="npi" name="npi" />
                    <FormField
                        useFormControl
                        label="Name"
                        id="name"
                        name="name"
                    />
                    <FormField
                        useFormControl
                        label="Link"
                        id="link"
                        name="link"
                    />
                    {showSensitiveData && (
                        <>
                            <FormField
                                useFormControl
                                label="Username"
                                id="username"
                                name="username"
                            />
                            <PasswordField
                                useFormControl
                                label="Password"
                                id="password"
                                name="password"
                            />
                        </>
                    )}
                </form>
            </Form>
        </AddEditDialog>
    );
}
