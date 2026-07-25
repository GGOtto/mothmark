import type {ReactNode} from "react";
import {PopupTemplate} from "./PopupTemplate";

type ConfirmPopupProps = {
	title: ReactNode;
	message?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};

export function ConfirmPopup({
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	danger = false,
	onConfirm,
	onCancel,
}: ConfirmPopupProps) {
	return (
		<PopupTemplate
			title={title}
			message={message}
			actions={
				<>
					<button
						type="button"
						className="popupButton popupButtonSecondary"
						onClick={onCancel}
						autoFocus
					>
						{cancelLabel}
					</button>

					<button
						type="button"
						className={["popupButton", danger ? "popupButtonDanger" : "popupButtonPrimary"].join(" ")}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
				</>
			}
		/>
	);
}
