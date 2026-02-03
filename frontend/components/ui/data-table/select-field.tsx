import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    FormControl,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useFormContext, Controller } from "react-hook-form";

interface SelectOption {
    value: string;
    label: string;
}

interface BaseSelectFieldProps {
    label: string;
    id: string;
    options: SelectOption[];
    disabled?: boolean;
    labelPosition?: "side" | "top";
    className?: string;
    name?: string;
    showFormMessage?: boolean;
}

interface ControlledSelectFieldProps extends BaseSelectFieldProps {
    useFormControl: true;
    name: string;
}

interface UncontrolledSelectFieldProps extends BaseSelectFieldProps {
    useFormControl?: false;
    value: string;
    onChange: (value: string) => void;
}

type SelectFieldProps =
    | ControlledSelectFieldProps
    | UncontrolledSelectFieldProps;

export function SelectField(props: SelectFieldProps) {
    const {
        label,
        id,
        options,
        disabled = false,
        labelPosition = "side",
        className,
        showFormMessage = true,
    } = props;

    const formContext = useFormContext();
    const isFormControlled = props.useFormControl || false;

    // If we're using form control and we have a form context
    if (isFormControlled && formContext) {
        const { name } = props as ControlledSelectFieldProps;

        return (
            <Controller
                name={name}
                control={formContext.control}
                render={({ field }) => (
                    <FormItem
                        className={cn(
                            labelPosition === "side"
                                ? "grid grid-cols-4 items-center gap-4"
                                : "flex flex-col gap-2",
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
                                    ? "col-span-3"
                                    : "w-full"
                            }
                        >
                            <FormControl>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={disabled}
                                >
                                    <SelectTrigger id={id}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {options.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            {showFormMessage && <FormMessage />}
                        </div>
                    </FormItem>
                )}
            />
        );
    }

    // For uncontrolled usage (direct value/onChange)
    const { value, onChange } = props as UncontrolledSelectFieldProps;

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
                <Select
                    value={value}
                    onValueChange={onChange}
                    disabled={disabled}
                >
                    <SelectTrigger id={id}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
