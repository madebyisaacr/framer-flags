import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const flagsDir =
	process.argv[2] ?? "/Users/isaac/Documents/Products/framer-flags/circle-flags-gh-pages/flags";
const jsonFile =
	process.argv[3] ??
	path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
		"src",
		"data",
		"circleFlags.json"
	);

function walk(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const out = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...walk(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".svg")) {
			out.push(fullPath);
		}
	}

	return out;
}

/** First path wins per basename (matches how `generateCircleFlagsJson.mjs` builds codes). */
function buildCodeToSvgPath(flagsRoot) {
	const map = new Map();
	for (const fullPath of walk(flagsRoot)) {
		const code = path.basename(fullPath, ".svg");
		if (!map.has(code)) {
			map.set(code, fullPath);
		}
	}
	return map;
}

const codeToPath = buildCodeToSvgPath(flagsDir);
const raw = fs.readFileSync(jsonFile, "utf8");
const entries = JSON.parse(raw);

if (!Array.isArray(entries)) {
	throw new Error(`Expected an array in ${jsonFile}`);
}

const missing = [];

for (const item of entries) {
	if (!item || typeof item !== "object") continue;
	const code = String(item.code ?? "");
	if (!code) continue;

	let svgPath = codeToPath.get(code);
	// e.g. JSON code `other/nato` vs on-disk `nato.svg` (basename-only in repo)
	if (!svgPath && code.includes("/")) {
		svgPath = codeToPath.get(code.slice(code.lastIndexOf("/") + 1));
	}
	if (!svgPath) {
		missing.push(code);
		delete item.svg;
		continue;
	}

	item.svg = fs.readFileSync(svgPath, "utf8");
}

fs.writeFileSync(jsonFile, JSON.stringify(entries, null, 2) + "\n", "utf8");

console.log(`Updated ${jsonFile} (${entries.length} entries).`);
if (missing.length) {
	console.log(`\nCodes with no matching SVG (${missing.length}):`);
	for (const c of missing) {
		console.log(c);
	}
} else {
	console.log("\nAll codes have a matching SVG.");
}
