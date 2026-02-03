import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    FormControl,
    FormItem,
    FormLabel,
    FormMessage,
    FormField as ShadcnFormField,
} from "@/components/ui/form";
import { useFormContext } from "react-hook-form";

interface BasePasswordFieldProps {
    label: string;
    id: string;
    name: string;
    placeholder?: string;
    disabled?: boolean;
    labelPosition?: "side" | "top";
    className?: string;
    showFormMessage?: boolean;
}

interface ControlledPasswordFieldProps extends BasePasswordFieldProps {
    useFormControl: true;
}

interface UncontrolledPasswordFieldProps extends BasePasswordFieldProps {
    useFormControl?: false;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

type PasswordFieldProps =
    | ControlledPasswordFieldProps
    | UncontrolledPasswordFieldProps;

export function PasswordField(props: PasswordFieldProps) {
    const {
        label,
        id,
        name,
        placeholder,
        disabled = false,
        labelPosition = "side",
        className,
        showFormMessage = true,
    } = props;

    const [showPassword, setShowPassword] = useState(false);
    const formContext = useFormContext();
    const isFormControlled = props.useFormControl || false;

    // Password toggle button
    const ToggleButton = () => (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 hover:bg-background py-0 px-0 gap-0 h-auto w-auto"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
        >
            {showPassword ? (
                <EyeOff className="h-4 w-4" />
            ) : (
                <Eye className="h-4 w-4" />
            )}
        </Button>
    );

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
                            <div className="relative">
                                <FormControl>
                                    <Input
                                        id={id}
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        placeholder={placeholder}
                                        disabled={disabled}
                                        className="w-full"
                                        {...field}
                                    />
                                </FormControl>
                                <ToggleButton />
                            </div>
                            {showFormMessage && <FormMessage />}
                        </div>
                    </FormItem>
                )}
            />
        );
    }

    // For uncontrolled usage (direct value/onChange)
    const { value, onChange } = props as UncontrolledPasswordFieldProps;

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
            <div
                className={cn(
                    "relative",
                    labelPosition === "side" ? "col-span-3" : "w-full"
                )}
            >
                <Input
                    id={id}
                    name={name}
                    type={showPassword ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                <ToggleButton />
            </div>
        </div>
    );
}
