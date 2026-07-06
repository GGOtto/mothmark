import type {ReactNode} from "react";

type FieldLabelProps = {
	children: ReactNode;
};

export function FieldLabel({children}: FieldLabelProps) {
	return <label className="rightSideBarFieldLabel">{children}</label>;
}
