import type {NextConfig} from "next";

const nextConfig: NextConfig = {
	devIndicators: false,
	serverExternalPackages: ["knex", "pg"],
	async redirects() {
		return [
			{source: "/editor", destination: "/worlds", permanent: false},
			{source: "/editor/:worldId", destination: "/worlds/:worldId", permanent: false},
		];
	},
};

export default nextConfig;
