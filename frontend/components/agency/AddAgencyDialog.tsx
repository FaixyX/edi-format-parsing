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

interface AddAgencyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AgencyFormValues) => void;
    isSubmitting: boolean;
    existingAgencies: Agency[];
    showSensitiveData?: boolean;
}

export function AddAgencyDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    existingAgencies,
    showSensitiveData = true,
}: AddAgencyDialogProps) {
    // Create schema with current agencies list (recreated when agencies change)
    // This ensures validation always uses the latest agencies data
    const schema = useMemo(
        () => createAgencySchema(existingAgencies),
        [existingAgencies]
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

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            form.reset({
                name: "",
                link: "",
                npi: "",
                username: "",
                password: "",
            });
            form.clearErrors();
        }
    }, [isOpen, form]);

    const handleSubmit = (data: AgencyFormValues) => {
        onSubmit(data);
    };

    const formId = "add-agency-form";

    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={() => {
                form.handleSubmit(handleSubmit)();
            }}
            title="Add New Agency"
            isSubmitting={isSubmitting}
            submitText="Add Agency"
            loadingText="Adding..."
        >
            <Form {...form}>
                <form
                    id={formId}
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-4"
                >
                    <FormField
                        useFormControl
                        label="NPI"
                        id="npi"
                        name="npi"
                    />
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
