import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const svgsDir = path.join(repoRoot, "public", "wikipedia_flag_svgs");

// Add the SVG filenames (basenames only) that you want to delete from:
// `public/wikipedia_flag_svgs/`
//
// Example:
// ["US.svg", "CA.svg"]
const FILES_TO_DELETE = [
	"AD.svg",
	"AF.svg",
	"AL.svg",
	"AR.svg",
	"AT.svg",
	"AZ.svg",
	"BO.svg",
	"CA.svg",
	"CO.svg",
	"CR.svg",
	"DE.svg",
	"DK.svg",
	"DO.svg",
	"ES.svg",
	"FI.svg",
	"GA.svg",
	"GT.svg",
	"HT.svg",
	"ID.svg",
	"IL.svg",
	"IN.svg",
	"IS.svg",
	"LA.svg",
	"MA.svg",
	"MD.svg",
	"ME.svg",
	"MN.svg",
	"MT.svg",
	"NE.svg",
	"NO.svg",
	"OR.svg",
	"PA.svg",
	"PE.svg",
	"PL.svg",
	"PY.svg",
	"RS.svg",
	"SC.svg",
	"SD.svg",
	"SV.svg",
	"TN.svg",
	"UY.svg",
	"VA.svg",
	"VE.svg",
];

function isSafeBasename(filename) {
	if (typeof filename !== "string") return false;
	const s = filename.trim();
	if (!s) return false;
	if (s !== path.basename(s)) return false; // blocks `../x` and `dir/x`
	if (s.includes("/") || s.includes("\\") || s.includes("\0")) return false;
	return true;
}

if (!fs.existsSync(svgsDir) || !fs.statSync(svgsDir).isDirectory()) {
	throw new Error(`Missing directory: ${svgsDir}`);
}

if (!Array.isArray(FILES_TO_DELETE)) {
	throw new Error("FILES_TO_DELETE must be an array of filenames.");
}

const rawFilenames = FILES_TO_DELETE;
const unique = [
	...new Set(rawFilenames.map((f) => (typeof f === "string" ? f.trim() : String(f)))),
];

const toDelete = [];
for (const filename of unique) {
	if (!isSafeBasename(filename)) {
		throw new Error(
			`Unsafe filename "${filename}". Provide basenames only (e.g. "US.svg"), not paths.`
		);
	}
	toDelete.push(filename);
}

const resolvedBase = path.resolve(svgsDir);
const existing = [];
const missing = [];

for (const filename of toDelete) {
	const filePath = path.resolve(path.join(svgsDir, filename));
	if (!filePath.startsWith(resolvedBase + path.sep) && filePath !== resolvedBase) {
		throw new Error(`Path traversal detected for "${filename}".`);
	}

	if (fs.existsSync(filePath)) existing.push({ filename, filePath });
	else missing.push(filename);
}

console.log(`Target dir: ${svgsDir}`);
console.log(`Requested: ${toDelete.length} file(s)`);
console.log(`Existing: ${existing.length}`);
if (missing.length) console.log(`Missing: ${missing.length}`);

let deleted = 0;
for (const { filePath, filename } of existing) {
	fs.rmSync(filePath, { force: false });
	deleted++;
	console.log(`Deleted: ${filename}`);
}

console.log(`\nDone. Deleted ${deleted}/${existing.length} existing file(s).`);
