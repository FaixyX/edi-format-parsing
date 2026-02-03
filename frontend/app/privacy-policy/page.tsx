export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

                <div className="prose prose-gray dark:prose-invert">
                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">
                            Overview
                        </h2>
                        <p className="mb-4">
                            This privacy policy describes how our internal
                            control panel application (&quot;the
                            Application&quot;) handles user data and
                            information.
                        </p>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">
                            Data Collection
                        </h2>
                        <p className="mb-4">
                            The Application is an internal tool used by
                            authorized company personnel only. We collect and
                            process the following information:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>
                                User authentication credentials (username,
                                password)
                            </li>
                            <li>
                                Google OAuth tokens (for Google Sheets
                                integration) - stored encrypted
                            </li>
                            <li>
                                Application usage data for system administration
                            </li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">
                            Google OAuth Integration
                        </h2>
                        <p className="mb-4">
                            When you link a Google account for Google Sheets
                            automation:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>
                                OAuth tokens are stored encrypted in our
                                database
                            </li>
                            <li>
                                Tokens are used only to access Google Sheets on
                                your behalf
                            </li>
                            <li>
                                You can unlink your Google account at any time
                                through Settings
                            </li>
                            <li>
                                We do not store your Google account password
                            </li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">
                            Data Security
                        </h2>
                        <p className="mb-4">
                            We implement industry-standard security measures:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>All sensitive data is encrypted at rest</li>
                            <li>
                                OAuth tokens are encrypted using HIPAA-compliant
                                encryption
                            </li>
                            <li>
                                Access is restricted to authorized personnel
                                only
                            </li>
                            <li>Regular security audits and updates</li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">
                            Data Access and Control
                        </h2>
                        <p className="mb-4">
                            As an authorized user, you have the right to:
                        </p>
                        <ul className="list-disc pl-6 mb-4">
                            <li>Access your account information</li>
                            <li>Unlink your Google account at any time</li>
                            <li>Request information about data we store</li>
                        </ul>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Contact</h2>
                        <p className="mb-4">
                            For questions about this privacy policy or data
                            handling, please contact your system administrator
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
