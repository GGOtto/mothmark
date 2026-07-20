import {useState} from "react";
import type {FormEvent, ReactNode} from "react";
import {PopupTemplate} from "./PopupTemplate";

type PromptPopupProps = {
	title: ReactNode;
	message?: ReactNode;
	label?: string;
	initialValue?: string;
	placeholder?: string;
	submitLabel?: string;
	cancelLabel?: string;
	required?: boolean;
	validate?: (value: string) => string | undefined;
	onSubmit: (value: string) => void;
	onCancel: () => void;
};

export function PromptPopup({
	title,
	message,
	label,
	initialValue = "",
	placeholder,
	submitLabel = "Save",
	cancelLabel = "Cancel",
	required = false,
	validate,
	onSubmit,
	onCancel,
}: PromptPopupProps) {
	const [value, setValue] = useState(initialValue);
	const [error, setError] = useState<string>();

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();

		const normalizedValue = value.trim();

		if (required && normalizedValue.length === 0) {
			setError("This field is required.");
			return;
		}

		const validationError = validate?.(normalizedValue);

		if (validationError) {
			setError(validationError);
			return;
		}

		onSubmit(normalizedValue);
	}

	return (
		<form onSubmit={handleSubmit}>
			<PopupTemplate
				title={title}
				message={message}
				actions={
					<>
						<button type="button" className="popupButton popupButtonSecondary" onClick={onCancel}>
							{cancelLabel}
						</button>

						<button type="submit" className="popupButton popupButtonPrimary">
							{submitLabel}
						</button>
					</>
				}
			>
				<label className="popupField">
					{label ? <span className="popupFieldLabel">{label}</span> : null}

					<input
						className="popupInput"
						value={value}
						placeholder={placeholder}
						aria-invalid={Boolean(error)}
						onChange={(event) => {
							setValue(event.target.value);
							setError(undefined);
						}}
						autoFocus
					/>

					{error ? (
						<span className="popupFieldError" role="alert">
							{error}
						</span>
					) : null}
				</label>
			</PopupTemplate>
		</form>
	);
}
