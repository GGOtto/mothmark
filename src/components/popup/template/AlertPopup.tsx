import type {ReactNode} from "react";
import {PopupTemplate} from "./PopupTemplate";

type AlertPopupProps = {
	title: ReactNode;
	message?: ReactNode;
	buttonLabel?: string;
	onClose: () => void;
};

export function AlertPopup({title, message, buttonLabel = "Okay", onClose}: AlertPopupProps) {
	return (
		<PopupTemplate
			title={title}
			message={message}
			actions={
				<button type="button" className="popupButton popupButtonPrimary" onClick={onClose} autoFocus>
					{buttonLabel}
				</button>
			}
		/>
	);
}
