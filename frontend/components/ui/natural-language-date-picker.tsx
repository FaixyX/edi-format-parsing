"use client";

import * as React from "react";
import { parseDate } from "chrono-node";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface NaturalLanguageDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    onDateChange?: (date: Date | undefined) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    className?: string;
}

function formatDate(date: Date | undefined) {
    if (!date) {
        return "";
    }

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

export function NaturalLanguageDatePicker({
    value,
    onChange,
    onDateChange,
    label = "Date",
    placeholder = "Tomorrow or next week",
    disabled = false,
    error,
    className,
}: NaturalLanguageDatePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(value);
    const [date, setDate] = React.useState<Date | undefined>(
        parseDate(value) || undefined
    );
    const [month, setMonth] = React.useState<Date | undefined>(date);

    // Update internal state when external value changes
    React.useEffect(() => {
        setInternalValue(value);
        const parsedDate = parseDate(value);
        if (parsedDate) {
            setDate(parsedDate);
            setMonth(parsedDate);
        }
    }, [value]);

    return (
        <FormItem className={cn("flex flex-col", className)}>
            <FormLabel>{label}</FormLabel>
            <div className="relative flex gap-2">
                <FormControl>
                    <Input
                        value={internalValue}
                        placeholder={placeholder}
                        className="bg-background pr-10"
                        onChange={(e) => {
                            const inputValue = e.target.value;
                            setInternalValue(inputValue);
                            onChange(inputValue);
                            const date = parseDate(inputValue);
                            if (date) {
                                setDate(date);
                                setMonth(date);
                                onDateChange?.(date);
                            } else {
                                onDateChange?.(undefined);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setOpen(true);
                            }
                        }}
                        disabled={disabled}
                    />
                </FormControl>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                            disabled={disabled}
                        >
                            <CalendarIcon className="size-3.5" />
                            <span className="sr-only">Select date</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="end"
                    >
                        <Calendar
                            mode="single"
                            selected={date}
                            captionLayout="dropdown"
                            month={month}
                            onMonthChange={setMonth}
                            onSelect={(date) => {
                                setDate(date);
                                if (date) {
                                    const formattedDate = formatDate(date);
                                    setInternalValue(formattedDate);
                                    onChange(formattedDate);
                                    onDateChange?.(date);
                                } else {
                                    onDateChange?.(undefined);
                                }
                                setOpen(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="text-muted-foreground px-1 text-sm">
                Assessment will be scheduled for{" "}
                <span className="font-medium">{formatDate(date)}</span>.
            </div>
            {error && <FormMessage>{error}</FormMessage>}
        </FormItem>
    );
}
