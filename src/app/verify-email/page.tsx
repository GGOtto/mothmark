import {AccountAuthForm} from "@/components/auth/AccountAuthForm";

export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{token?: string}>;
}) {
	return <AccountAuthForm mode="verify" token={(await searchParams).token ?? ""} />;
}
