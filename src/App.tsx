import { Draggable, framer, useIsAllowedTo } from "framer-plugin";
import { useEffect, useMemo, useState } from "react";
import AdminUI from "./AdminUI";
import { SearchIcon } from "./Icons";
import cx from "classnames";
import "./App.css";
import { codeToFlag } from "./flags";
import countryNames from "./data/countryNames.json";
import countryCodes from "./data/countryCodes.json";

const IS_CANVAS = framer.mode === "canvas";
const IS_LOCALHOST =
	typeof window !== "undefined" &&
	(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const PERMISSION_METHODS = IS_CANVAS ? ["createFrameNode", "setImage"] : ["setImage"];

const ICON_SETS = {
	twemoji: "Twemoji",
	wikipedia: "Wikipedia",
	circleFlags: "Circle Flags",
};

void framer.showUI({
	position: "top right",
	width: IS_CANVAS ? 260 : 600,
	minWidth: IS_CANVAS ? 260 : 600,
	maxWidth: 600,
	height: IS_CANVAS ? 450 : 625,
	minHeight: 400,
	maxHeight: 740,
	resizable: IS_CANVAS,
});

export function App() {
	const [showAdminUI, setShowAdminUI] = useState(false);

	useEffect(() => {
		if (!IS_LOCALHOST) {
			void framer.setMenu([]);
			return;
		}
		void framer.setMenu([
			{
				label: showAdminUI ? "Back" : "Admin Menu",
				onAction: () => setShowAdminUI((prev) => !prev),
			},
		]);
	}, [showAdminUI]);

	return IS_LOCALHOST && showAdminUI ? <AdminUI /> : <PaymentCardLogosApp />;
}

function PaymentCardLogosApp() {
	const isAllowedToEdit = useIsAllowedTo(
		...(PERMISSION_METHODS as unknown as Parameters<typeof useIsAllowedTo>)
	);

	const [query, setQuery] = useState("");
	const [iconSet, setIconSet] = useState<keyof typeof ICON_SETS>("twemoji");

	const sortedCodes = useMemo(() => [...countryCodes].sort((a, b) => a.localeCompare(b)), []);

	return (
		<main className="payment-card-logos">
			<div className="toolbar">
				<div className="search-header">
					<input
						type="text"
						placeholder="Search…"
						value={query}
						className="search-input"
						onChange={(e) => setQuery(e.target.value)}
						autoFocus
					/>
					<div className="search-icon-wrap">
						<SearchIcon />
					</div>
				</div>
			</div>
			<select
				value={iconSet}
				onChange={(e) => setIconSet(e.target.value as keyof typeof ICON_SETS)}
				className="icon-set-dropdown"
			>
				{Object.entries(ICON_SETS).map(([key, value]) => (
					<option key={key} value={key}>
						{value}
					</option>
				))}
			</select>
			<div className={cx("grid", framer.mode === "canvas" ? "canvas" : "image")}>
				{sortedCodes.map((code) => (
					<TwemojiFlag key={code} code={code} />
				))}
			</div>
		</main>
	);
}

function TwemojiFlag({ code }: { code: string }) {
	const name = countryNames[code] ?? code;
	const emoji = codeToFlag(code);
	const emojiURL = emojiToURL(emoji);

	return (
		<Draggable
			key={code}
			data={{
				type: "image",
				image: emojiURL,
				previewImage: emojiURL,
				name,
				altText: name,
			}}
		>
			<img src={emojiURL} alt={name} title={name} className="flag-emoji" draggable={false} />
		</Draggable>
	);
}

function emojiToURL(emoji: string): string {
	const codepoint = [...emoji].map((char) => (char.codePointAt(0) ?? 0).toString(16)).join("-");
	return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/15.1.0/72x72/${codepoint}.png`;
}
