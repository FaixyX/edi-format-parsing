"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface SelectOption {
    value: string | number;
    label: string;
}

interface MultiSelectFieldProps {
    label: string;
    id: string;
    options: SelectOption[];
    value: (string | number)[];
    onChange: (value: (string | number)[]) => void;
    disabled?: boolean;
    labelPosition?: "side" | "top";
    className?: string;
    placeholder?: string;
    emptyMessage?: string;
    searchPlaceholder?: string;
}

export function MultiSelectField({
    label,
    id,
    options,
    value,
    onChange,
    disabled = false,
    labelPosition = "side",
    className,
    placeholder = "Select options...",
    emptyMessage = "No options found.",
    searchPlaceholder = "Search...",
}: MultiSelectFieldProps) {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (selectedValue: string | number) => {
        const newValue = value.includes(selectedValue)
            ? value.filter((v) => v !== selectedValue)
            : [...value, selectedValue];
        onChange(newValue);
    };

    const handleRemove = (selectedValue: string | number) => {
        const newValue = value.filter((v) => v !== selectedValue);
        onChange(newValue);
    };

    const selectedOptions = options.filter((option) =>
        value.includes(option.value)
    );

    const displayText =
        selectedOptions.length > 0
            ? `${selectedOptions.length} selected`
            : placeholder;

    return (
        <div
            className={cn(
                labelPosition === "side"
                    ? "grid grid-cols-4 items-start gap-4"
                    : "flex flex-col gap-2",
                className
            )}
        >
            <Label
                htmlFor={id}
                className={labelPosition === "side" ? "text-right pt-2" : ""}
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
                                {displayText}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                        <Command>
                            <CommandInput placeholder={searchPlaceholder} />
                            <CommandList>
                                <CommandEmpty>{emptyMessage}</CommandEmpty>
                                <CommandGroup>
                                    {options.map((option) => (
                                        <CommandItem
                                            key={option.value.toString()}
                                            value={option.value.toString()}
                                            onSelect={() =>
                                                handleSelect(option.value)
                                            }
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value.includes(option.value)
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

                {/* Display selected items as badges */}
                {selectedOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {selectedOptions.map((option) => (
                            <Badge
                                key={option.value.toString()}
                                variant="secondary"
                                className="text-xs"
                            >
                                {option.label}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 ml-1 hover:bg-transparent"
                                    onClick={() => handleRemove(option.value)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
