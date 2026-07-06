import type {ReactNode} from "react";

type FieldLabelProps = {
	children: ReactNode;
	htmlFor?: string;
};

export function FieldLabel({children, htmlFor}: FieldLabelProps) {
	return (
		<label className="rightSideBarFieldLabel" htmlFor={htmlFor}>
			{children}
		</label>
	);
}
