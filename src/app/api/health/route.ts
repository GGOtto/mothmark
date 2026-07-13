// src/app/api/health/route.ts
import {NextResponse} from "next/server";

export const dynamic = "force-static";

export function GET() {
	return NextResponse.json({
		ok: true,
		service: "mothmark",
	});
}
