import type {NextConfig} from "next";

const nextConfig: NextConfig = {
	devIndicators: false,
	// Cloudflare Pages serves static assets from the generated `out` directory.
	output: "export",
};

export default nextConfig;
