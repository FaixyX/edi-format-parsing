import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface PasswordDisplayProps {
    password: string;
    showPassword: boolean;
    onTogglePassword: () => void;
    className?: string;
}

export function PasswordDisplay({
    password,
    showPassword,
    onTogglePassword,
    className = "max-w-[150px]",
}: PasswordDisplayProps) {
    return (
        <div className="flex items-center gap-4">
            <Input
                type={showPassword ? "text" : "password"}
                value={password}
                readOnly
                className={`${className} border-none bg-transparent`}
            />
            <Button variant="ghost" size="icon" onClick={onTogglePassword}>
                {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                ) : (
                    <Eye className="h-4 w-4" />
                )}
            </Button>
        </div>
    );
}
