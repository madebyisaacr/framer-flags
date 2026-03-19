import {
	Draggable,
	framer,
	useIsAllowedTo,
	isFrameNode,
	isWebPageNode,
	isComponentNode,
} from "framer-plugin";
import { useEffect, useMemo, useState } from "react";
import AdminUI from "./AdminUI";
import { SearchIcon } from "./Icons";
import cx from "classnames";
import "./App.css";
import { codeToFlag } from "./flags";
import countryNames from "./data/countryNames.json";
import countryCodes from "./data/countryCodes.json";
import wikipediaCountryFlags from "./data/wikipediaCountryFlags.json";
import wikipediaUnitedStatesFlags from "./data/wikipediaUnitedStatesFlags.json";

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

const WIKIPEDIA_FLAG_SCOPES = {
	countries: "Countries",
	unitedStates: "United States",
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
	const [wikipediaScope, setWikipediaScope] =
		useState<keyof typeof WIKIPEDIA_FLAG_SCOPES>("countries");

	const sortedCodes = useMemo(() => [...countryCodes].sort((a, b) => a.localeCompare(b)), []);
	const sortedWikipediaCountryFlags = useMemo(
		() => [...wikipediaCountryFlags].sort((a, b) => a.name.localeCompare(b.name)),
		[]
	);
	const unitedStatesFlag = useMemo(
		() => wikipediaCountryFlags.find((flag) => flag.code === "US"),
		[]
	);
	const wikipediaFlags = useMemo(() => {
		if (wikipediaScope === "countries") return sortedWikipediaCountryFlags;
		return unitedStatesFlag
			? [unitedStatesFlag, ...wikipediaUnitedStatesFlags]
			: wikipediaUnitedStatesFlags;
	}, [sortedWikipediaCountryFlags, unitedStatesFlag, wikipediaScope]);
	const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
	const filteredTwemojiCodes = useMemo(() => {
		if (iconSet !== "twemoji") return [];
		if (!normalizedQuery) return sortedCodes;
		return sortedCodes
			.filter((code) => {
				const name = countryNames[code as keyof typeof countryNames] ?? "";
				const normalizedCode = code.toLowerCase();
				const normalizedName = name.toLowerCase();
				return normalizedCode.includes(normalizedQuery) || normalizedName.includes(normalizedQuery);
			})
			.sort((a, b) => {
				const aName = (countryNames[a as keyof typeof countryNames] ?? "").toLowerCase();
				const bName = (countryNames[b as keyof typeof countryNames] ?? "").toLowerCase();
				const aCode = a.toLowerCase();
				const bCode = b.toLowerCase();
				const aExact = Number(aCode === normalizedQuery || aName === normalizedQuery);
				const bExact = Number(bCode === normalizedQuery || bName === normalizedQuery);
				if (aExact !== bExact) return bExact - aExact;
				return a.localeCompare(b);
			});
	}, [iconSet, normalizedQuery, sortedCodes]);
	const filteredWikipediaFlags = useMemo(() => {
		if (iconSet !== "wikipedia") return [];
		if (!normalizedQuery) return wikipediaFlags;
		return wikipediaFlags
			.filter((flag) => {
				const normalizedCode = flag.code?.toLowerCase() ?? "";
				const normalizedName = flag.name.toLowerCase();
				return normalizedCode.includes(normalizedQuery) || normalizedName.includes(normalizedQuery);
			})
			.sort((a, b) => {
				const aCode = a.code?.toLowerCase() ?? "";
				const bCode = b.code?.toLowerCase() ?? "";
				const aName = a.name.toLowerCase();
				const bName = b.name.toLowerCase();
				const aExact = Number(aCode === normalizedQuery || aName === normalizedQuery);
				const bExact = Number(bCode === normalizedQuery || bName === normalizedQuery);
				if (aExact !== bExact) return bExact - aExact;
				return a.name.localeCompare(b.name);
			});
	}, [iconSet, normalizedQuery, wikipediaFlags]);

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
			<div className="toolbar">
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
				{iconSet === "wikipedia" && (
					<select
						value={wikipediaScope}
						onChange={(e) =>
							setWikipediaScope(e.target.value as keyof typeof WIKIPEDIA_FLAG_SCOPES)
						}
						className="icon-set-dropdown"
					>
						{Object.entries(WIKIPEDIA_FLAG_SCOPES).map(([key, value]) => (
							<option key={key} value={key}>
								{value}
							</option>
						))}
					</select>
				)}
			</div>
			<div className={cx("grid", framer.mode === "canvas" ? "canvas" : "image")}>
				{iconSet === "twemoji"
					? filteredTwemojiCodes.map((code) => <TwemojiFlag key={code} code={code} />)
					: filteredWikipediaFlags.map((flag) => (
							<WikipediaFlag key={`${flag.code}-${flag.name}`} flag={flag} />
						))}
			</div>
		</main>
	);
}

function TwemojiFlag({ code }: { code: string }) {
	const name = countryNames[code as keyof typeof countryNames] ?? code;
	const emoji = codeToFlag(code);
	const emojiURL = emojiToURL(emoji);

	const onClick = async () => {
		await insertImageFrame(name, emojiURL);
	};

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
			<img
				src={emojiURL}
				alt={name}
				title={name}
				className="twemoji-flag"
				draggable={false}
				onClick={onClick}
			/>
		</Draggable>
	);
}

type WikipediaFlagData = (typeof wikipediaCountryFlags)[0] | (typeof wikipediaUnitedStatesFlags)[0];

function WikipediaFlag({ flag }: { flag: WikipediaFlagData }) {
	const name = flag.name;
	const imageURL = flag.imageURL;
	const onClick = async () => {
		await insertImageFrame(name, imageURL);
	};

	return (
		<Draggable
			key={name}
			data={{ type: "image", image: imageURL, previewImage: imageURL, name, altText: name }}
		>
			<div className="wikipedia-flag">
				<img src={imageURL} alt={name} title={name} draggable={false} onClick={onClick} />
			</div>
		</Draggable>
	);
}

function emojiToURL(emoji: string): string {
	const codepoint = [...emoji].map((char) => (char.codePointAt(0) ?? 0).toString(16)).join("-");
	return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/15.1.0/72x72/${codepoint}.png`;
}

async function calculateParentId() {
	const selection = await framer.getSelection();
	const selectedFrames = selection.filter(isFrameNode);
	let parentId = selectedFrames[0]?.id;

	if (!parentId) {
		const canvasRoot = await framer.getCanvasRoot();
		if (isWebPageNode(canvasRoot)) {
			const children = await canvasRoot.getChildren();
			const primaryBreakpoint = children?.find(
				(child) => isFrameNode(child) && child.isPrimaryBreakpoint
			);

			if (primaryBreakpoint) {
				parentId = primaryBreakpoint.id;
			}
		} else if (isComponentNode(canvasRoot)) {
			const children = await canvasRoot.getChildren();
			const primaryVariant = children?.find(
				(child) => isFrameNode(child) && child.isPrimaryVariant
			);

			if (primaryVariant) {
				parentId = primaryVariant.id;
			}
		}
	}

	return parentId;
}

async function insertImageFrame(name: string, imageUrl: string) {
	try {
		const parentId = await calculateParentId();

		if (typeof imageUrl !== "string" || !imageUrl) {
			framer.notify(`Missing image URL for ${name}`, { variant: "error" });
			return;
		}

		const image = await framer.uploadImage({
			image: imageUrl,
			altText: name,
		});

		const frame = await framer.createFrameNode(
			{
				name,
				width: "200px",
				height: "fit-image",
				backgroundImage: image,
			},
			parentId
		);

		if (frame) {
			void framer.setSelection([frame.id]);
		}
	} catch {
		framer.notify(`Couldn't add ${name}`, { variant: "error" });
	}
}
