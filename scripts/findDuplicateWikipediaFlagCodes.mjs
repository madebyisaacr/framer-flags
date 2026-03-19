import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const defaultInputFile = path.join(repoRoot, "src", "data", "wikipediaFlags.json");
const inputFile = process.argv[2] ?? defaultInputFile;
const includeNames = process.argv.includes("--names");
const failOnDuplicates = process.argv.includes("--fail");

const raw = fs.readFileSync(inputFile, "utf8");
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
	throw new Error(`Expected an array in ${inputFile}`);
}

// Count occurrences of each `code`.
const counts = new Map(); // code -> count
const byCode = new Map(); // code -> array of entries (for optional details)

for (const item of parsed) {
	if (!item || typeof item !== "object") continue;
	const code = String(item.code ?? "").trim();
	if (!code) continue;

	counts.set(code, (counts.get(code) ?? 0) + 1);

	if (includeNames) {
		const arr = byCode.get(code) ?? [];
		arr.push(item);
		byCode.set(code, arr);
	}
}

const duplicates = [...counts.entries()]
	.filter(([, count]) => count > 1)
	.sort((a, b) => a[0].localeCompare(b[0]));

console.log(`Duplicate codes (count > 1): ${duplicates.length}`);
for (const [code, count] of duplicates) {
	if (!includeNames) {
		console.log(`${code}\t${count}`);
		continue;
	}

	console.log(`${code}\t${count}`);
	const entries = byCode.get(code) ?? [];
	for (const entry of entries) {
		const type = String(entry.type ?? "").trim();
		const name = String(entry.name ?? "").trim();
		const label = [type, name].filter(Boolean).join(" - ");
		console.log(`  ${label || "(missing type/name)"}`);
	}
}

if (duplicates.length > 0) {
	// Make it easy to use this in CI / shell scripts.
	if (failOnDuplicates) process.exitCode = 1;
}

