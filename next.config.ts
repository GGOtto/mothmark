import type {NextConfig} from "next";

const nextConfig: NextConfig = {
	devIndicators: false,
	productionBrowserSourceMaps: false,
	serverExternalPackages: ["knex", "pg", "wordnet-db"],
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "Content-Security-Policy",
						value: "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
					},
					{key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()"},
					{key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
					{key: "X-Content-Type-Options", value: "nosniff"},
					{key: "X-Frame-Options", value: "DENY"},
				],
			},
		];
	},
	async redirects() {
		return [
			{source: "/editor", destination: "/worlds", permanent: false},
			{source: "/editor/:worldId", destination: "/worlds/:worldId", permanent: false},
		];
	},
};

export default nextConfig;
