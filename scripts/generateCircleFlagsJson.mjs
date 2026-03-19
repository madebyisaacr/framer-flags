import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const flagsDir =
	process.argv[2] ?? "/Users/isaac/Documents/Products/framer-flags/circle-flags-gh-pages/flags";
const outFile =
	process.argv[3] ??
	"/Users/isaac/Documents/Products/framer-flags/framer-flags/src/data/circleFlags.json";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const countryNamesPath = path.join(repoRoot, "src", "data", "countryNames.json");
const countryNames = JSON.parse(fs.readFileSync(countryNamesPath, "utf8"));

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

const svgPaths = walk(flagsDir);
const codes = svgPaths.map((p) => path.basename(p, ".svg"));
codes.sort((a, b) => a.localeCompare(b));

const json = codes.map((code) => ({
	code,
	// `countryNames.json` uses uppercase ISO codes. Many circle-flags entries
	// are not 2-letter countries (e.g. subregions), so those should stay blank.
	name: countryNames[code.toUpperCase()] ?? "",
}));
fs.writeFileSync(outFile, JSON.stringify(json, null, 2) + "\n", "utf8");

console.log(`Wrote ${json.length} flags to ${outFile}`);
