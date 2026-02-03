import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { FileText, Shield, BarChart3, Users, ArrowRight } from "lucide-react";

export default function HomePage() {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b">
                <div className="container mx-auto px-4 py-4 flex items-center">
                    <h1 className="text-2xl font-bold">billup</h1>
                    <nav className="flex gap-4 ml-auto items-center">
                        <Link
                            href="/privacy-policy"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center"
                        >
                            Privacy Policy
                        </Link>
                        <Link href="/login">
                            <Button variant="outline" size="sm">
                                Login
                            </Button>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <main className="container mx-auto px-4 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold mb-4">
                        Welcome to <span className="text-primary">billup</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                        A comprehensive control panel application for managing
                        healthcare agency billing, monitoring EDI file
                        processing, and automating form submissions with Google
                        Sheets integration.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link href="/login">
                            <Button size="lg" className="gap-2">
                                Get Started
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Features Section */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                    <Card>
                        <CardHeader>
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Billing File Management</CardTitle>
                            <CardDescription>
                                Upload and process EDI 835 billing files with
                                automatic NPI extraction and agency matching for
                                streamlined healthcare billing workflows.
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <BarChart3 className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Task Monitoring</CardTitle>
                            <CardDescription>
                                Monitor form submissions and EDI billing file
                                processing tasks in real-time with detailed
                                validation results and status tracking.
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <Users className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Agency Management</CardTitle>
                            <CardDescription>
                                Manage healthcare agencies, configure settings,
                                and track NPI information for efficient billing
                                operations.
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <Shield className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Secure & Compliant</CardTitle>
                            <CardDescription>
                                Built with security in mind, featuring encrypted
                                OAuth token storage, HIPAA-compliant encryption,
                                and role-based access control.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>

                {/* About Section */}
                <Card className="mb-16">
                    <CardHeader>
                        <CardTitle>About billup</CardTitle>
                        <CardDescription>
                            Understanding our application purpose
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-4">
                            <strong>billup</strong> is an internal control panel
                            application designed to streamline healthcare
                            billing operations. Our platform enables authorized
                            personnel to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>
                                Upload and process EDI 835 billing files with
                                automatic agency matching
                            </li>
                            <li>
                                Monitor background tasks and form submission
                                processing
                            </li>
                            <li>
                                Manage healthcare agency configurations and
                                settings
                            </li>
                            <li>
                                Integrate with Google Sheets for automated data
                                workflows
                            </li>
                            <li>
                                Track patient validation results and billing
                                file processing status
                            </li>
                        </ul>
                        <p className="text-muted-foreground mt-4">
                            This application is intended for internal company
                            use by authorized personnel only. All data is
                            encrypted and secured according to industry
                            standards.
                        </p>
                    </CardContent>
                </Card>

                {/* Footer */}
                <footer className="border-t pt-8 mt-16">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} billup. All rights
                            reserved.
                        </p>
                        <div className="flex gap-6">
                            <Link
                                href="/privacy-policy"
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Privacy Policy
                            </Link>
                            <Link
                                href="/terms-of-service"
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Terms of Service
                            </Link>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
