import type {ReactNode} from "react";

type PopupTemplateProps = {
	title: ReactNode;
	message?: ReactNode;
	children?: ReactNode;
	actions: ReactNode;
};

export function PopupTemplate({title, message, children, actions}: PopupTemplateProps) {
	return (
		<div className="popupTemplate">
			<header className="popupTemplateHeader">
				<h2 className="popupTemplateTitle">{title}</h2>

				{message ? <div className="popupTemplateMessage">{message}</div> : null}
			</header>

			{children ? <div className="popupTemplateContent">{children}</div> : null}

			<footer className="popupTemplateActions">{actions}</footer>
		</div>
	);
}
