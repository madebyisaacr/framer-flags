import {
	Draggable,
	framer,
	useIsAllowedTo,
	isFrameNode,
	isWebPageNode,
	isComponentNode,
} from "framer-plugin";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminUI from "./AdminUI";
import { SearchIcon } from "./Icons";
import cx from "classnames";
import "./App.css";
import { codeToFlag } from "./flags";
import twemojiCountryNames from "./data/twemojiCountryNames.json";
import wikipediaFlags from "./data/wikipediaFlags.json";
import circleFlags from "./data/circleFlags.json";
import sourcesData from "./data/sources.json";

const IS_CANVAS = framer.mode === "canvas";
const IS_LOCALHOST =
	typeof window !== "undefined" &&
	(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const PERMISSION_METHODS = IS_CANVAS ? ["createFrameNode", "setImage"] : ["setImage"];

const ICON_SETS = {
	wikipediaCountries: "Wikipedia - Countries",
	wikipediaUnitedStates: "Wikipedia - United States",
	twemoji: "Twemoji",
	circleFlags: "Circle Flags",
};
const DEFAULT_ICON_SET = "wikipediaCountries";

const ICON_SET_STORAGE_KEY = "framer-flags.iconSet";
let lastInsertedFrameId: string | null = null;

function isIconSetKey(value: string): value is keyof typeof ICON_SETS {
	return Object.prototype.hasOwnProperty.call(ICON_SETS, value);
}

type WikipediaCombinedFlag = {
	type: "country" | "unitedStatesState";
	code: string;
	name: string;
	imageUrl: string;
	tags?: string;
};

type CircleFlagData = {
	code: string;
	name: string;
	tags?: string;
};

type SourceEntry = {
	id: string;
	name: string;
	url: string;
	license?: string | null;
	licenseUrl?: string | null;
};

type TwemojiCountryCode = keyof typeof twemojiCountryNames;

const sourcesById = (sourcesData as SourceEntry[]).reduce<Record<string, SourceEntry>>(
	(acc, entry) => {
		acc[entry.id] = entry;
		return acc;
	},
	{}
);

if (IS_CANVAS) {
	void framer.showUI({
		position: "top right",
		width: 260,
		minWidth: 260,
		maxWidth: 400,
		height: 450,
		minHeight: 400,
		maxHeight: 740,
		resizable: true,
	});
} else {
	void framer.showUI({
		width: 600,
		height: 500,
		resizable: false,
	});
}

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
	const searchInputRef = useRef<HTMLInputElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const [iconSet, setIconSet] = useState<keyof typeof ICON_SETS>(() => {
		if (typeof window === "undefined") return DEFAULT_ICON_SET;

		try {
			const stored = window.localStorage.getItem(ICON_SET_STORAGE_KEY);
			if (stored && isIconSetKey(stored)) return stored;
		} catch {
			// Ignore localStorage failures (e.g. blocked by browser settings).
		}

		return DEFAULT_ICON_SET;
	});

	const [showSourceModal, setShowSourceModal] = useState(false);
	const [sourceModalIconSet, setSourceModalIconSet] =
		useState<keyof typeof ICON_SETS>(DEFAULT_ICON_SET);

	const changeIconSet = (next: keyof typeof ICON_SETS) => {
		setIconSet(next);
		searchInputRef.current?.focus();
		gridRef.current?.scrollTo({ top: 0 });

		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(ICON_SET_STORAGE_KEY, next);
		} catch {
			// Ignore localStorage failures (e.g. blocked by browser settings).
		}
	};

	const activeSource = sourcesById[sourceModalIconSet];

	const sortedCodes = useMemo(
		() => [...Object.keys(twemojiCountryNames)].sort((a, b) => a.localeCompare(b)),
		[]
	);
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
				const name = twemojiCountryNames[code as TwemojiCountryCode] ?? "";
				const normalizedCode = code.toLowerCase();
				const normalizedName = name.toLowerCase();
				return normalizedCode.includes(normalizedQuery) || normalizedName.includes(normalizedQuery);
			})
			.sort((a, b) => {
				const aName = (twemojiCountryNames[a as TwemojiCountryCode] ?? "").toLowerCase();
				const bName = (twemojiCountryNames[b as TwemojiCountryCode] ?? "").toLowerCase();
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
				const normalizedCode = (flag.code?.toLowerCase() ?? "").split("_")[0];
				const normalizedName = flag.name.toLowerCase();
				const normalizedTags = (flag.tags ?? "").toLowerCase();
				return (
					normalizedCode.includes(normalizedQuery) ||
					normalizedName.includes(normalizedQuery) ||
					normalizedTags.includes(normalizedQuery)
				);
			})
			.sort((a, b) => {
				const aCode = (a.code?.toLowerCase() ?? "").split("_")[0];
				const bCode = (b.code?.toLowerCase() ?? "").split("_")[0];
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
				const tags = (flag.tags || "").toLowerCase();
				return (
					code.includes(normalizedQuery) ||
					name.includes(normalizedQuery) ||
					tags.includes(normalizedQuery)
				);
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
						ref={searchInputRef}
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
				<button
					type="button"
					className="icon-set-info-button"
					onClick={() => {
						setSourceModalIconSet(iconSet);
						setShowSourceModal(true);
					}}
					aria-label="Source information"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M10 9V14"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>
						<circle cx="10" cy="5.5" r="1.25" fill="currentColor"></circle>
					</svg>
				</button>
			</div>
			<div className={cx("grid", framer.mode === "canvas" ? "canvas" : "image")} ref={gridRef}>
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

			{showSourceModal && activeSource && (
				<div className="modal-container">
					<div className="modal-backdrop" onClick={() => setShowSourceModal(false)} />
					<div className="modal">
						<div className="modal-content">
							<p className="modal-title">Source</p>
							<p>
								<a href={activeSource.url} target="_blank" rel="noopener noreferrer">
									{activeSource.name}
								</a>
							</p>
							{activeSource.license && (
								<p>
									License:{" "}
									{activeSource.licenseUrl ? (
										<a href={activeSource.licenseUrl} target="_blank" rel="noopener noreferrer">
											{activeSource.license}
										</a>
									) : (
										activeSource.license
									)}
								</p>
							)}
						</div>
						<button type="button" onClick={() => setShowSourceModal(false)}>
							OK
						</button>
					</div>
				</div>
			)}
		</main>
	);
}

function TwemojiFlag({ code, isAllowedToEdit }: { code: string; isAllowedToEdit: boolean }) {
	const name = twemojiCountryNames[code as TwemojiCountryCode] ?? code;
	const emoji = codeToFlag(code);
	const emojiURL = emojiToTwemojiURL(emoji);

	const onClick = async () => {
		if (!isAllowedToEdit) {
			framer.notify("You don't have permission to edit.", { variant: "error" });
			return;
		}
		await insertImage(name, emojiURL);
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
			<div className="twemoji-flag" onClick={onClick}>
				<img src={emojiURL} alt={name} title={name} draggable={false} loading="lazy" />
			</div>
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
		await insertImage(name, imageURL);
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
			<div className="circle-flag" onClick={onClick}>
				<img src={imageURL} alt={name} title={name} draggable={false} loading="lazy" />
			</div>
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
	const imageURL = flag.imageUrl;
	const onClick = async () => {
		if (!isAllowedToEdit) {
			framer.notify("You don't have permission to edit.", { variant: "error" });
			return;
		}
		await insertImage(name, imageURL);
	};

	return (
		<Draggable
			key={name}
			data={{ type: "image", image: imageURL, previewImage: imageURL, name, altText: name }}
		>
			<div className="wikipedia-flag">
				<img
					src={imageURL}
					alt={name}
					title={name}
					draggable={false}
					onClick={onClick}
					loading="lazy"
				/>
			</div>
		</Draggable>
	);
}

function emojiToTwemojiURL(emoji: string): string {
	const codepoint = [...emoji].map((char) => (char.codePointAt(0) ?? 0).toString(16)).join("-");
	// return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/15.1.0/72x72/${codepoint}.png`;
	// return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/15.1.0/108x108/${codepoint}.png`;
	return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/15.1.0/svg/${codepoint}.svg`;
}

function circleFlagCodeToURL(code: string): string {
	// Circle flags are served from `/flags/{code}.svg` on hatscripts.
	return `https://hatscripts.github.io/circle-flags/flags/${encodeURIComponent(code)}.svg`;
}

async function calculateParentId() {
	const selection = await framer.getSelection();
	const selectedFrames = selection.filter(isFrameNode);
	const selectedFrame = selectedFrames[0];
	let parentId = selectedFrame?.id;

	if (selectedFrame && selectedFrame.id === lastInsertedFrameId) {
		const selectedFrameParent = await framer.getParent(selectedFrame.id);
		if (selectedFrameParent?.id) {
			parentId = selectedFrameParent.id;
		}
	}

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

async function insertImage(name: string, imageUrl: string) {
	if (!IS_CANVAS) {
		let success = false;
		try {
			await framer.setImage({ image: imageUrl, altText: name });
			success = true;
		} catch (error) {
			console.error(error);
		}

		if (!success) {
			framer.notify(`Failed to insert "${name}" flag`, { variant: "error" });
			return;
		}

		void framer.closePlugin(`Inserted ${name} flag`, { variant: "success" });
	}

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
				width: "100px",
				height: "fit-image",
				backgroundImage: image,
			},
			parentId
		);

		if (frame) {
			lastInsertedFrameId = frame.id;
			void framer.setSelection([frame.id]);

			void framer.notify(`Inserted ${name} flag`, { variant: "success" });
		}
	} catch {
		framer.notify(`Failed to insert ${name} flag`, { variant: "error" });
	}
}

function isWikipediaCombinedFlag(value: unknown): value is WikipediaCombinedFlag {
	if (!value || typeof value !== "object") return false;
	const v = value as {
		type?: unknown;
		code?: unknown;
		name?: unknown;
		imageUrl?: unknown;
		tags?: unknown;
	};
	return (
		(v.type === "country" || v.type === "unitedStatesState") &&
		typeof v.code === "string" &&
		typeof v.name === "string" &&
		typeof v.imageUrl === "string" &&
		(typeof v.tags === "undefined" || typeof v.tags === "string")
	);
}
