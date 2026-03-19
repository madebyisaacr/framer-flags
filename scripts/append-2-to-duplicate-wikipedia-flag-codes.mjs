import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const defaultInputFile = path.join(repoRoot, "src", "data", "wikipediaFlags.json");
const inputFile = process.argv[2] ?? defaultInputFile;
const outputFile = process.argv[3] ?? inputFile;

const dryRun = process.argv.includes("--dry-run");

const raw = fs.readFileSync(inputFile, "utf8");
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
	throw new Error(`Expected an array in ${inputFile}`);
}

// code -> indices of items in `parsed` that currently share that exact code string.
const codeToIndices = new Map();
for (let i = 0; i < parsed.length; i++) {
	const item = parsed[i];
	if (!item || typeof item !== "object") continue;

	const code = String(item.code ?? "").trim();
	if (!code) continue;

	const arr = codeToIndices.get(code) ?? [];
	arr.push(i);
	codeToIndices.set(code, arr);
}

const duplicateEntries = [...codeToIndices.entries()].filter(([, indices]) => indices.length > 1);
duplicateEntries.sort((a, b) => a[0].localeCompare(b[0]));

if (duplicateEntries.length === 0) {
	console.log(`No duplicate codes found in ${path.relative(repoRoot, inputFile)}.`);
	if (outputFile !== inputFile && !dryRun) {
		fs.writeFileSync(outputFile, JSON.stringify(parsed, null, 2) + "\n", "utf8");
		console.log(`Wrote (unchanged) output to: ${path.relative(repoRoot, outputFile)}`);
	}
	process.exit(0);
}

let changed = 0;
const renameLog = [];

for (const [code, indices] of duplicateEntries) {
	if (indices.length !== 2) {
		// User note: there should be no duplicates beyond 2.
		throw new Error(
			`Expected duplicate code count to be 2, but got ${indices.length} for code "${code}".`
		);
	}

	// If the duplicated base code already ends with "_2", we'd produce "_2_2".
	if (code.endsWith("_2")) {
		throw new Error(
			`Duplicate code "${code}" already ends with "_2". Refusing to rename to "${code}_2".`
		);
	}

	const [firstIdx, secondIdx] = indices;
	const nextCode = `${code}_2`;

	// Prevent collisions if the file already contains the "_2" variant.
	const collision = codeToIndices.get(nextCode);
	if (collision && collision.length > 0) {
		throw new Error(
			`Renaming code "${code}" to "${nextCode}" would collide with existing entries for "${nextCode}".`
		);
	}

	parsed[secondIdx].code = nextCode;
	changed++;
	renameLog.push({ from: code, to: nextCode, firstIndex: firstIdx, secondIndex: secondIdx });
}

// Verify: after renames, there should be no duplicates.
const postCounts = new Map();
for (const item of parsed) {
	if (!item || typeof item !== "object") continue;
	const code = String(item.code ?? "").trim();
	if (!code) continue;
	postCounts.set(code, (postCounts.get(code) ?? 0) + 1);
}
const postDuplicates = [...postCounts.entries()].filter(([, count]) => count > 1);
if (postDuplicates.length > 0) {
	throw new Error(
		`Renaming completed, but duplicates still exist after the change: ${JSON.stringify(
			postDuplicates
		)}`
	);
}

console.log(
	[
		`Duplicate codes found: ${duplicateEntries.length}`,
		`Renamed entries: ${changed}`,
		`input=${path.relative(repoRoot, inputFile)}`,
		`output=${path.relative(repoRoot, outputFile)}${dryRun ? " (dry-run)" : ""}`,
	].join("\n")
);

for (const r of renameLog) {
	console.log(`- ${r.from} -> ${r.to}`);
}

if (dryRun) {
	console.log("Dry-run enabled; not writing changes to disk.");
	process.exit(0);
}

if (outputFile !== inputFile) {
	fs.writeFileSync(outputFile, JSON.stringify(parsed, null, 2) + "\n", "utf8");
	console.log(`Wrote updated JSON to: ${path.relative(repoRoot, outputFile)}`);
} else {
	fs.writeFileSync(inputFile, JSON.stringify(parsed, null, 2) + "\n", "utf8");
	console.log(`Wrote updated JSON in place: ${path.relative(repoRoot, inputFile)}`);
}

