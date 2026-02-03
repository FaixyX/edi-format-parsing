import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async redirects() {
        return [
            {
                source: "/control-panel/monitoring",
                destination: "/control-panel/837-files/monitoring",
                permanent: false,
            },
            {
                source: "/control-panel/billing-files",
                destination: "/control-panel/837-files/billing-files",
                permanent: false,
            },
        ];
    },
};
export default nextConfig;
