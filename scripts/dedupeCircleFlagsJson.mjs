import fs from "fs";
import path from "path";

const defaultInput = path.join(
	path.dirname(new URL(import.meta.url).pathname),
	"..",
	"src",
	"data",
	"circleFlags.json"
);

const inputFile = process.argv[2] ?? defaultInput;
const outputFile = process.argv[3] ?? inputFile;

const raw = fs.readFileSync(inputFile, "utf8");
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
	throw new Error(`Expected an array in ${inputFile}`);
}

// Deduplicate while preserving the first-seen order of each `code`.
const byCode = new Map();
const order = [];

for (const item of parsed) {
	if (!item || typeof item !== "object") continue;
	const code = String(item.code ?? "");
	if (!code) continue;

	const existing = byCode.get(code);
	if (!existing) {
		byCode.set(code, item);
		order.push(code);
		continue;
	}

	// Prefer the duplicate that has a non-empty `name`.
	const existingName = String(existing.name ?? "");
	const nextName = String(item.name ?? "");
	if (!existingName && nextName) {
		byCode.set(code, item);
	}
}

const deduped = order.map((code) => byCode.get(code));
fs.writeFileSync(outputFile, JSON.stringify(deduped, null, 2) + "\n", "utf8");

console.log(
	`Deduped by code: ${parsed.length} -> ${deduped.length} (${path.basename(
		inputFile
	)}). Output: ${outputFile}`
);
