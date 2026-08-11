const SESSION_CLIENT_LABEL_MAX_LENGTH = 120;

export function sessionClientLabel(userAgent: string | null): string | null {
	if (!userAgent) return null;
	const browser = /Edg\//.test(userAgent)
		? "Edge"
		: /OPR\//.test(userAgent)
			? "Opera"
			: /Firefox\/|FxiOS\//.test(userAgent)
				? "Firefox"
				: /Chrome\/|CriOS\//.test(userAgent)
					? "Chrome"
					: /Safari\//.test(userAgent) && /Version\//.test(userAgent)
						? "Safari"
						: "Browser";
	const device = /iPad/.test(userAgent)
		? "iPad"
		: /iPhone|iPod/.test(userAgent)
			? "iPhone"
			: /Android/.test(userAgent)
				? "Android"
				: /Windows/.test(userAgent)
					? "Windows"
					: /Macintosh|Mac OS X/.test(userAgent)
						? "macOS"
						: /Linux/.test(userAgent)
							? "Linux"
							: null;
	return `${browser}${device ? ` on ${device}` : ""}`.slice(0, SESSION_CLIENT_LABEL_MAX_LENGTH);
}
