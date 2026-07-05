type ToggleProp = {
	toggleValue: boolean;
	setToggleValue: (value: boolean) => void;
};

export function Toggle({toggleValue, setToggleValue}: ToggleProp) {
	function handleToggle() {
		setToggleValue(!toggleValue);
	}
	return <div onClick={handleToggle}>{toggleValue}</div>;
}
