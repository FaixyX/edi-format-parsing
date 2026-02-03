import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as React from "react";
import {
    FormControl,
    FormItem,
    FormLabel,
    FormMessage,
    FormField as ShadcnFormField,
} from "@/components/ui/form";
import { useFormContext } from "react-hook-form";

interface BaseFormFieldProps {
    label: string;
    id: string;
    name: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    labelPosition?: "side" | "top";
    className?: string;
    description?: string;
    showFormMessage?: boolean;
}

interface ControlledFormFieldProps extends BaseFormFieldProps {
    useFormControl: true;
}

interface UncontrolledFormFieldProps extends BaseFormFieldProps {
    useFormControl?: false;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

type FormFieldProps = ControlledFormFieldProps | UncontrolledFormFieldProps;

export function FormField(props: FormFieldProps) {
    const {
        label,
        id,
        name,
        type = "text",
        placeholder,
        disabled = false,
        labelPosition = "side",
        className,
        showFormMessage = true,
    } = props;

    const formContext = useFormContext();
    const isFormControlled = props.useFormControl || false;

    // If we're using form control and we have a form context
    if (isFormControlled && formContext) {
        return (
            <ShadcnFormField
                control={formContext.control}
                name={name}
                render={({ field }) => (
                    <FormItem
                        className={cn(
                            labelPosition === "side"
                                ? "grid grid-cols-4 items-center gap-4"
                                : "flex flex-col gap-1",
                            className
                        )}
                    >
                        <FormLabel
                            htmlFor={id}
                            className={
                                labelPosition === "side" ? "text-right" : ""
                            }
                        >
                            {label}
                        </FormLabel>
                        <div
                            className={
                                labelPosition === "side"
                                    ? "col-span-3 space-y-1"
                                    : "w-full space-y-1"
                            }
                        >
                            <FormControl>
                                <Input
                                    id={id}
                                    type={type}
                                    placeholder={placeholder}
                                    disabled={disabled}
                                    className="w-full"
                                    {...field}
                                />
                            </FormControl>
                            {showFormMessage && <FormMessage />}
                        </div>
                    </FormItem>
                )}
            />
        );
    }

    // For uncontrolled usage (direct value/onChange)
    const { value, onChange } = props as UncontrolledFormFieldProps;

    return (
        <div
            className={cn(
                labelPosition === "side"
                    ? "grid grid-cols-4 items-center gap-4"
                    : "flex flex-col gap-1",
                className
            )}
        >
            <Label
                htmlFor={id}
                className={labelPosition === "side" ? "text-right" : ""}
            >
                {label}
            </Label>
            <Input
                id={id}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                className={labelPosition === "side" ? "col-span-3" : "w-full"}
            />
        </div>
    );
}
