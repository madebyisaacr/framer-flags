import { framer, isFrameNode } from "framer-plugin";
import wikipediaFlagsData from "./data/wikipediaFlags.json";

export default function AdminUI() {
	const insertImages = async () => {
		const selection = await framer.getSelection();
		const selectedFrame = selection.length === 1 && isFrameNode(selection[0]) ? selection[0] : null;

		if (selectedFrame) {
			const batchSize = 10;

			for (let index = 0; index < wikipediaFlagsData.length; index += batchSize) {
				const batch = wikipediaFlagsData.slice(index, index + batchSize);

				await Promise.all(
					batch.map(async (flag) => {
						const svgPath = `/wikipedia_flag_svgs/${flag.type}/${flag.code}.svg`;
						const svgResponse = await fetch(svgPath);
						if (!svgResponse.ok) {
							throw new Error(`Failed to fetch SVG for ${flag.code} from ${svgPath}`);
						}
						const svgMarkup = await svgResponse.text();
						const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

						const image = await framer.uploadImage({
							image: svgDataUri,
							altText: flag.name,
							name: flag.name,
						});

						framer.createFrameNode(
							{
								name: flag.code,
								width: "1fr",
								height: "fit-image",
								backgroundImage: image,
							},
							selectedFrame.id
						);
					})
				);
			}
		}
	};

	const saveImageUrlsFromSelectedFrame = async () => {
		const selection = await framer.getSelection();
		const selectedFrame = selection.length === 1 && isFrameNode(selection[0]) ? selection[0] : null;

		if (!selectedFrame) {
			framer.notify("Select exactly one frame first.");
			return;
		}

		const children = await selectedFrame.getChildren();
		const imageUrlByCode = new Map<string, string>();

		for (const child of children) {
			if (!isFrameNode(child)) continue;
			const imageUrl = child.backgroundImage?.url;
			const childCode = child.name;
			if (typeof childCode !== "string" || childCode.length === 0) continue;
			if (typeof imageUrl !== "string" || imageUrl.length === 0) continue;
			imageUrlByCode.set(childCode, imageUrl);
		}

		const updatedFlags = wikipediaFlagsData.map((flag) => ({
			...flag,
			imageUrl: imageUrlByCode.get(flag.code) ?? "",
		}));

		const jsonString = `${JSON.stringify(updatedFlags, null, "\t")}\n`;
		const blob = new Blob([jsonString], { type: "application/json" });
		const downloadUrl = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = downloadUrl;
		anchor.download = "wikipediaFlags.json";
		anchor.click();
		URL.revokeObjectURL(downloadUrl);

		const matchedCount = updatedFlags.filter((flag) => flag.imageUrl).length;
		framer.notify(`Saved ${matchedCount} image URLs to downloaded JSON.`);
	};

	return (
		<main className="admin-ui">
			<button onClick={() => insertImages()}>Insert Wikipedia Flags</button>
			<button onClick={() => saveImageUrlsFromSelectedFrame()}>Save Image URLs To JSON</button>
		</main>
	);
}
