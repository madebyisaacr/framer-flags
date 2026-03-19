import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const failOnUnknownType = argv.includes("--fail-on-unknown-type");
const failOnAmbiguousType = argv.includes("--fail-on-ambiguous-type");
const overwriteExisting = argv.includes("--overwrite");

// Allow `flagsDir` as the first non-option argument.
const firstNonOption = argv.find((a) => !a.startsWith("--"));
const flagsDir = firstNonOption ?? path.join(repoRoot, "public", "wikipedia_flag_svgs");

const wikipediaFlagsPath = path.join(repoRoot, "src", "data", "wikipediaFlags.json");

const raw = fs.readFileSync(wikipediaFlagsPath, "utf8");
const entries = JSON.parse(raw);

if (!Array.isArray(entries)) {
	throw new Error(`Expected an array in ${wikipediaFlagsPath}`);
}

// Map `CODE` -> `type` using uppercase for robustness.
const codeToTypes = new Map(); // CODE -> Set<type>

for (const item of entries) {
	if (!item || typeof item !== "object") continue;
	const code = String(item.code ?? "").trim();
	if (!code) continue;

	const type = String(item.type ?? "").trim();
	const codeUpper = code.toUpperCase();

	const set = codeToTypes.get(codeUpper) ?? new Set();
	set.add(type);
	codeToTypes.set(codeUpper, set);
}

let ambiguousCodes = 0;
for (const [codeUpper, types] of codeToTypes.entries()) {
	if (types.size > 1) ambiguousCodes++;
}
if (ambiguousCodes > 0) {
	console.warn(`Warning: ${ambiguousCodes} codes map to multiple ` + "`type`" + ` values in wikipediaFlags.json.`);
}

const targetTypes = new Set(["country", "unitedStatesState"]);

if (!fs.existsSync(flagsDir)) {
	throw new Error(`Directory not found: ${flagsDir}`);
}

for (const targetType of targetTypes) {
	const p = path.join(flagsDir, targetType);
	if (!fs.existsSync(p)) {
		throw new Error(
			`Expected subfolder to exist (per your note): ${path.relative(repoRoot, p)}`
		);
	}
}

const dirEntries = fs.readdirSync(flagsDir, { withFileTypes: true });

let scanned = 0;
let moved = 0;
let skippedUnknownCode = 0;
let skippedNonSvg = 0;
let skippedUnknownType = 0;

for (const entry of dirEntries) {
	if (!entry.isFile()) continue;

	const fileName = entry.name;
	if (!fileName.endsWith(".svg")) {
		skippedNonSvg++;
		continue;
	}

	const code = path.basename(fileName, ".svg");
	const codeUpper = code.toUpperCase();

	const types = codeToTypes.get(codeUpper);
	if (!types || types.size === 0) {
		skippedUnknownCode++;
		continue;
	}

	const typeList = [...types];
	const type = typeList[0];
	if (types.size > 1) {
		const msg = `Ambiguous type(s) for code "${codeUpper}": [${typeList.join(
			", "
		)}] (file: ${fileName})`;
		if (failOnAmbiguousType) throw new Error(msg);
		console.warn(msg + " Using the first type.");
	}

	if (!targetTypes.has(type)) {
		skippedUnknownType++;
		const msg = `Unknown type "${type}" for code "${codeUpper}" (file: ${fileName})`;
		if (failOnUnknownType) throw new Error(msg);
		console.warn(msg);
		continue;
	}

	const targetDir = path.join(flagsDir, type);
	const targetPath = path.join(targetDir, fileName);
	const sourcePath = path.join(flagsDir, fileName);

	scanned++;
	if (dryRun) {
		console.log(`[dry-run] Move ${path.relative(repoRoot, sourcePath)} -> ${path.relative(repoRoot, targetPath)}`);
		moved++;
		continue;
	}

	if (fs.existsSync(targetPath)) {
		if (overwriteExisting) {
			fs.renameSync(sourcePath, targetPath);
			moved++;
		} else {
			console.warn(
				`Skipping move; destination already exists: ${path.relative(repoRoot, targetPath)}`
			);
		}
		continue;
	}

	fs.renameSync(sourcePath, targetPath);
	moved++;
}

console.log(
	[
		`Done moving Wikipedia flag svgs:`,
		`flagsDir=${path.relative(repoRoot, flagsDir)}`,
		`scannedSvgFiles=${scanned}`,
		`moved=${moved}${dryRun ? " (dry-run)" : ""}`,
		`skippedUnknownCode=${skippedUnknownCode}`,
		`skippedNonSvg=${skippedNonSvg}`,
		`skippedUnknownType=${skippedUnknownType}`,
	].join("\n")
);

