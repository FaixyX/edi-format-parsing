"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    FormControl,
    FormItem,
    FormLabel,
    FormMessage,
    FormField as ShadcnFormField,
} from "@/components/ui/form";
import { useFormContext } from "react-hook-form";

interface SelectOption {
    value: string | number;
    label: string;
}

interface BaseComboboxFieldProps {
    label: string;
    id: string;
    options: SelectOption[];
    disabled?: boolean;
    labelPosition?: "side" | "top";
    className?: string;
    name?: string;
    placeholder?: string;
    showFormMessage?: boolean;
    emptyMessage?: string;
    searchPlaceholder?: string;
}

interface ControlledComboboxFieldProps extends BaseComboboxFieldProps {
    useFormControl: true;
    name: string;
}

interface UncontrolledComboboxFieldProps extends BaseComboboxFieldProps {
    useFormControl?: false;
    value: string | number;
    onChange: (value: string) => void;
}

type ComboboxFieldProps =
    | ControlledComboboxFieldProps
    | UncontrolledComboboxFieldProps;

export function ComboboxField(props: ComboboxFieldProps) {
    const {
        label,
        id,
        options,
        disabled = false,
        labelPosition = "side",
        className,
        placeholder = "Select an option...",
        showFormMessage = true,
        emptyMessage = "No option found.",
        searchPlaceholder = "Search...",
    } = props;

    const [open, setOpen] = React.useState(false);
    const formContext = useFormContext();
    const isFormControlled = props.useFormControl || false;

    // If we're using form control and we have a form context
    if (isFormControlled && formContext) {
        const { name } = props as ControlledComboboxFieldProps;

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
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id={id}
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={open}
                                            className="w-full justify-between"
                                            disabled={disabled}
                                        >
                                            <span className="truncate mr-2 flex-1 text-left">
                                                {field.value
                                                    ? options.find(
                                                          (option) =>
                                                              option.value.toString() ===
                                                              field.value.toString()
                                                      )?.label || field.value
                                                    : placeholder}
                                            </span>
                                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command
                                            // Enable case-insensitive filtering and search through data-search attribute
                                            filter={(value, search) => {
                                                // Find the option with this value
                                                const option = options.find(
                                                    (opt) =>
                                                        opt.value.toString() ===
                                                        value
                                                );
                                                if (
                                                    option &&
                                                    (option as any)[
                                                        "data-search"
                                                    ]
                                                ) {
                                                    // Use data-search attribute if available
                                                    return (option as any)[
                                                        "data-search"
                                                    ].includes(
                                                        search.toLowerCase()
                                                    );
                                                }
                                                // Fallback to default filtering on value and label
                                                if (option) {
                                                    return (
                                                        option.label
                                                            .toLowerCase()
                                                            .includes(
                                                                search.toLowerCase()
                                                            ) ||
                                                        value
                                                            .toLowerCase()
                                                            .includes(
                                                                search.toLowerCase()
                                                            )
                                                    );
                                                }
                                                return value
                                                    .toLowerCase()
                                                    .includes(
                                                        search.toLowerCase()
                                                    );
                                            }}
                                        >
                                            <CommandInput
                                                placeholder={searchPlaceholder}
                                            />
                                            <CommandList>
                                                <CommandEmpty>
                                                    {emptyMessage}
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {options.map((option) => (
                                                        <CommandItem
                                                            key={option.value.toString()}
                                                            value={option.value.toString()}
                                                            onSelect={(
                                                                currentValue
                                                            ) => {
                                                                const finalValue =
                                                                    currentValue ===
                                                                    field.value?.toString()
                                                                        ? ""
                                                                        : currentValue;

                                                                field.onChange(
                                                                    finalValue
                                                                );
                                                                setOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    option.value.toString() ===
                                                                        field.value?.toString()
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                            {option.label}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </FormControl>
                            {showFormMessage && <FormMessage />}
                        </div>
                    </FormItem>
                )}
            />
        );
    }

    // For uncontrolled usage (direct value/onChange)
    const { value, onChange } = props as UncontrolledComboboxFieldProps;

    return (
        <div
            className={cn(
                labelPosition === "side"
                    ? "grid grid-cols-4 items-center gap-4"
                    : "flex flex-col gap-2",
                className
            )}
        >
            <Label
                htmlFor={id}
                className={labelPosition === "side" ? "text-right" : ""}
            >
                {label}
            </Label>
            <div className={labelPosition === "side" ? "col-span-3" : "w-full"}>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            id={id}
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between"
                            disabled={disabled}
                        >
                            <span className="truncate mr-2 flex-1 text-left">
                                {value
                                    ? options.find(
                                          (option) =>
                                              option.value.toString() ===
                                              value.toString()
                                      )?.label || value
                                    : placeholder}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                        <Command
                            // Enable case-insensitive filtering and search through data-search attribute
                            filter={(value, search) => {
                                // Find the option with this value
                                const option = options.find(
                                    (opt) => opt.value.toString() === value
                                );

                                if (!option) {
                                    return 0;
                                }

                                const searchTerm = search.toLowerCase();

                                // Search in the label (which contains code, name, and SOC date)
                                if (
                                    option.label
                                        .toLowerCase()
                                        .includes(searchTerm)
                                ) {
                                    return 1;
                                }

                                // For patient episodes, also search in specific fields if available
                                if (
                                    (option as any).code &&
                                    (option as any).code
                                        .toLowerCase()
                                        .includes(searchTerm)
                                ) {
                                    return 1;
                                }

                                if (
                                    (option as any).name &&
                                    (option as any).name
                                        .toLowerCase()
                                        .includes(searchTerm)
                                ) {
                                    return 1;
                                }

                                if (
                                    (option as any).mrn &&
                                    (option as any).mrn
                                        .toLowerCase()
                                        .includes(searchTerm)
                                ) {
                                    return 1;
                                }

                                // Don't search in the value (ID) as it can cause false matches
                                return 0;
                            }}
                        >
                            <CommandInput placeholder={searchPlaceholder} />
                            <CommandList>
                                <CommandEmpty>{emptyMessage}</CommandEmpty>
                                <CommandGroup>
                                    {options.map((option) => (
                                        <CommandItem
                                            key={option.value.toString()}
                                            value={option.value.toString()}
                                            onSelect={(currentValue) => {
                                                // Always convert to string for onChange
                                                const finalValue =
                                                    currentValue ===
                                                    value.toString()
                                                        ? ""
                                                        : currentValue;

                                                onChange(finalValue);
                                                setOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    option.value.toString() ===
                                                        value.toString()
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                )}
                                            />
                                            {option.label}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
