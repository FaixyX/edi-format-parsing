"use client";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useLoginForm } from "@/hooks/features/auth/useLoginForm";
import { FormField as CustomFormField } from "@/components/ui/data-table/form-field";
import { PasswordField } from "@/components/ui/data-table/password-field";

export function LoginForm() {
    const { form, onSubmit, isLoading } = useLoginForm();

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
                {/* Username Field */}
                <CustomFormField
                    useFormControl={true}
                    label="Username"
                    id="username"
                    name="username"
                    labelPosition="top"
                    placeholder="Enter your username"
                />

                {/* Password Field */}
                <PasswordField
                    useFormControl={true}
                    label="Password"
                    id="password"
                    name="password"
                    labelPosition="top"
                    placeholder="Enter your password"
                />

                {/* Keep Me Logged In Checkbox */}
                <FormField
                    control={form.control}
                    name="keepLoggedIn"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>Keep me logged in</FormLabel>
                                <FormDescription>
                                    Stay logged in on this device for
                                    convenience
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                />

                {/* Submit Button */}
                <Button
                    type="submit"
                    isLoading={isLoading}
                    loadingText="Logging in..."
                    className="w-full"
                >
                    Login
                </Button>
            </form>
        </Form>
    );
}
