import type {NextConfig} from "next";

const nextConfig: NextConfig = {
	devIndicators: false,
	serverExternalPackages: ["knex", "pg"],
};

export default nextConfig;
