import {AccountAuthForm} from "@/components/auth/AccountAuthForm";

export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<{token?: string}>;
}) {
	return <AccountAuthForm mode="reset" token={(await searchParams).token ?? ""} />;
}
