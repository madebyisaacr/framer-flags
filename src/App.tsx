import {
	framer,
	Draggable,
	useIsAllowedTo,
	isFrameNode,
	isWebPageNode,
	isComponentNode,
	type CanvasRootNode,
	type FrameNode,
} from "framer-plugin";
import { useEffect, useRef, useState } from "react";
import AdminUI from "./AdminUI";
import { SearchIcon } from "./Icons";
import cx from "classnames";
import { copyToClipboard } from "./utils";
import "./App.css";
import { generateAllFlagEmojis } from "./flags";

const IS_CANVAS = framer.mode === "canvas";
const IS_LOCALHOST =
	typeof window !== "undefined" &&
	(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const PERMISSION_METHODS = IS_CANVAS ? ["createFrameNode", "setImage"] : ["setImage"];

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
			{generateAllFlagEmojis()}
		</main>
	);
}
