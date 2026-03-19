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
import wikipediaFlags from "./data/wikipediaFlags.json";
import circleFlags from "./data/circleFlags.json";

const IS_CANVAS = framer.mode === "canvas";
const IS_LOCALHOST =
	typeof window !== "undefined" &&
	(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const PERMISSION_METHODS = IS_CANVAS ? ["createFrameNode", "setImage"] : ["setImage"];

const ICON_SETS = {
	twemoji: "Twemoji",
	wikipediaCountries: "Wikipedia - Countries",
	wikipediaUnitedStates: "Wikipedia - United States",
	circleFlags: "Circle Flags",
};

const ICON_SET_STORAGE_KEY = "framer-flags.iconSet";

function isIconSetKey(value: string): value is keyof typeof ICON_SETS {
	return Object.prototype.hasOwnProperty.call(ICON_SETS, value);
}

type WikipediaCombinedFlag = {
	type: "country" | "unitedStatesState";
	code: string;
	name: string;
	imageURL: string;
};

type CircleFlagData = {
	code: string;
	name: string;
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
	const [iconSet, setIconSet] = useState<keyof typeof ICON_SETS>(() => {
		if (typeof window === "undefined") return "twemoji";

		try {
			const stored = window.localStorage.getItem(ICON_SET_STORAGE_KEY);
			if (stored && isIconSetKey(stored)) return stored;
		} catch {
			// Ignore localStorage failures (e.g. blocked by browser settings).
		}

		return "twemoji";
	});

	const changeIconSet = (next: keyof typeof ICON_SETS) => {
		setIconSet(next);

		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(ICON_SET_STORAGE_KEY, next);
		} catch {
			// Ignore localStorage failures (e.g. blocked by browser settings).
		}
	};

	const sortedCodes = useMemo(() => [...countryCodes].sort((a, b) => a.localeCompare(b)), []);
	const sortedWikipediaCountryFlags = useMemo(() => {
		const allWikipediaFlags = wikipediaFlags as unknown[];

		return allWikipediaFlags
			.filter(isWikipediaCombinedFlag)
			.filter((f) => f.type === "country")
			.sort((a, b) => a.name.localeCompare(b.name));
	}, []);
	const sortedUnitedStatesStateFlags = useMemo(() => {
		const allWikipediaFlags = wikipediaFlags as unknown[];

		return allWikipediaFlags
			.filter(isWikipediaCombinedFlag)
			.filter((f) => f.type === "unitedStatesState")
			.sort((a, b) => a.name.localeCompare(b.name));
	}, []);

	const sortedCircleFlags = useMemo(() => {
		const allCircleFlags = circleFlags as unknown as CircleFlagData[];
		return allCircleFlags.slice().sort((a, b) => {
			const aName = (a.name || "").trim();
			const bName = (b.name || "").trim();
			if (aName && bName) return aName.localeCompare(bName);
			if (aName && !bName) return -1;
			if (!aName && bName) return 1;
			return a.code.localeCompare(b.code);
		});
	}, []);
	const unitedStatesFlag = useMemo(() => {
		const allWikipediaFlags = wikipediaFlags as unknown[];

		return allWikipediaFlags
			.filter(isWikipediaCombinedFlag)
			.find((flag) => flag.type === "country" && flag.code === "US");
	}, []);

	const wikipediaFlagsForSelectedType = useMemo(() => {
		if (iconSet === "wikipediaCountries") return sortedWikipediaCountryFlags;
		if (iconSet === "wikipediaUnitedStates") {
			return unitedStatesFlag
				? [unitedStatesFlag, ...sortedUnitedStatesStateFlags]
				: sortedUnitedStatesStateFlags;
		}
		return [] as WikipediaCombinedFlag[];
	}, [iconSet, sortedWikipediaCountryFlags, sortedUnitedStatesStateFlags, unitedStatesFlag]);
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
		if (iconSet !== "wikipediaCountries" && iconSet !== "wikipediaUnitedStates") return [];
		if (!normalizedQuery) return wikipediaFlagsForSelectedType;
		return wikipediaFlagsForSelectedType
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
	}, [iconSet, normalizedQuery, wikipediaFlagsForSelectedType]);

	const filteredCircleFlags = useMemo(() => {
		if (iconSet !== "circleFlags") return [];
		if (!normalizedQuery) return sortedCircleFlags;

		return sortedCircleFlags
			.filter((flag) => {
				const code = flag.code.toLowerCase();
				const name = (flag.name || "").toLowerCase();
				return code.includes(normalizedQuery) || name.includes(normalizedQuery);
			})
			.sort((a, b) => {
				const aCode = a.code.toLowerCase();
				const bCode = b.code.toLowerCase();
				const aName = (a.name || "").toLowerCase();
				const bName = (b.name || "").toLowerCase();

				const aExact = Number(aCode === normalizedQuery || aName === normalizedQuery);
				const bExact = Number(bCode === normalizedQuery || bName === normalizedQuery);
				if (aExact !== bExact) return bExact - aExact;

				const aSort = aName || aCode;
				const bSort = bName || bCode;
				return aSort.localeCompare(bSort);
			});
	}, [iconSet, normalizedQuery, sortedCircleFlags]);

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
					onChange={(e) => changeIconSet(e.target.value as keyof typeof ICON_SETS)}
					className="icon-set-dropdown"
				>
					{Object.entries(ICON_SETS).map(([key, value]) => (
						<option key={key} value={key}>
							{value}
						</option>
					))}
				</select>
			</div>
			<div className={cx("grid", framer.mode === "canvas" ? "canvas" : "image")}>
				{iconSet === "twemoji" &&
					filteredTwemojiCodes.map((code) => (
						<TwemojiFlag key={code} code={code} isAllowedToEdit={isAllowedToEdit} />
					))}
				{iconSet === "circleFlags" &&
					filteredCircleFlags.map((flag) => (
						<CircleFlag key={flag.code} flag={flag} isAllowedToEdit={isAllowedToEdit} />
					))}
				{(iconSet === "wikipediaCountries" || iconSet === "wikipediaUnitedStates") &&
					filteredWikipediaFlags.map((flag) => (
						<WikipediaFlag
							key={`${flag.code}-${flag.name}`}
							flag={flag}
							isAllowedToEdit={isAllowedToEdit}
						/>
					))}
			</div>
		</main>
	);
}

function TwemojiFlag({ code, isAllowedToEdit }: { code: string; isAllowedToEdit: boolean }) {
	const name = countryNames[code as keyof typeof countryNames] ?? code;
	const emoji = codeToFlag(code);
	const emojiURL = emojiToURL(emoji);

	const onClick = async () => {
		if (!isAllowedToEdit) {
			framer.notify("You don't have permission to edit.", { variant: "error" });
			return;
		}
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

function CircleFlag({ flag, isAllowedToEdit }: { flag: CircleFlagData; isAllowedToEdit: boolean }) {
	const name = (flag.name || "").trim() || flag.code;
	const imageURL = circleFlagCodeToURL(flag.code);

	const onClick = async () => {
		if (!isAllowedToEdit) {
			framer.notify("You don't have permission to edit.", { variant: "error" });
			return;
		}
		await insertImageFrame(name, imageURL);
	};

	return (
		<Draggable
			key={flag.code}
			data={{
				type: "image",
				image: imageURL,
				previewImage: imageURL,
				name,
				altText: name,
			}}
		>
			<img
				src={imageURL}
				alt={name}
				title={name}
				className="circle-flag"
				draggable={false}
				onClick={onClick}
			/>
		</Draggable>
	);
}

type WikipediaFlagData = WikipediaCombinedFlag;

function WikipediaFlag({
	flag,
	isAllowedToEdit,
}: {
	flag: WikipediaFlagData;
	isAllowedToEdit: boolean;
}) {
	const name = flag.name;
	const imageURL = flag.imageURL;
	const onClick = async () => {
		if (!isAllowedToEdit) {
			framer.notify("You don't have permission to edit.", { variant: "error" });
			return;
		}
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

function circleFlagCodeToURL(code: string): string {
	// Circle flags are served from `/flags/{code}.svg` on hatscripts.
	return `https://hatscripts.github.io/circle-flags/flags/${encodeURIComponent(code)}.svg`;
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

function isWikipediaCombinedFlag(value: unknown): value is WikipediaCombinedFlag {
	if (!value || typeof value !== "object") return false;
	const v = value as { type?: unknown; code?: unknown; name?: unknown; imageURL?: unknown };
	return (
		(v.type === "country" || v.type === "unitedStatesState") &&
		typeof v.code === "string" &&
		typeof v.name === "string" &&
		typeof v.imageURL === "string"
	);
}
