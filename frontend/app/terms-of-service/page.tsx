export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
                
                <div className="prose prose-gray dark:prose-invert">
                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Acceptance of Terms</h2>
                        <p className="mb-4">
                            By accessing and using this internal control panel application (&quot;the Application&quot;),
                            you agree to be bound by these Terms of Service.
                        </p>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Authorized Use</h2>
                        <p className="mb-4">
                            This Application is intended for internal company use only. You agree to:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>Use the Application only for authorized business purposes</li>
                            <li>Maintain the confidentiality of your account credentials</li>
                            <li>Not share your account with unauthorized persons</li>
                            <li>Comply with all company policies and applicable laws</li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Google Sheets Integration</h2>
                        <p className="mb-4">
                            When linking a Google account:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>You authorize the Application to access your Google Sheets on your behalf</li>
                            <li>You are responsible for ensuring you have proper authorization to link the account</li>
                            <li>The Application will only access Google Sheets as needed for automation tasks</li>
                            <li>You can unlink your Google account at any time</li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Data Responsibility</h2>
                        <p className="mb-4">
                            You are responsible for:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>Ensuring data entered into the Application is accurate and authorized</li>
                            <li>Maintaining compliance with HIPAA and other applicable regulations</li>
                            <li>Protecting sensitive information in accordance with company policies</li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Prohibited Activities</h2>
                        <p className="mb-4">
                            You agree not to:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>Attempt to gain unauthorized access to the Application or its data</li>
                            <li>Use the Application for any illegal or unauthorized purpose</li>
                            <li>Interfere with or disrupt the Application&apos;s operation</li>
                            <li>Share account credentials with unauthorized persons</li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
                        <p className="mb-4">
                            The Application is provided &quot;as is&quot; for internal use. The company is not liable
                            for any indirect, incidental, or consequential damages arising from use of the Application.
                        </p>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
                        <p className="mb-4">
                            We reserve the right to modify these terms at any time. Continued use of the
                            Application after changes constitutes acceptance of the modified terms.
                        </p>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Contact</h2>
                        <p className="mb-4">
                            For questions about these terms, please contact your system administrator
                            or IT department.
                        </p>
                    </section>

                    <section className="mb-6">
                        <p className="text-sm text-muted-foreground">
                            Last updated: {new Date().toLocaleDateString()}
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}


