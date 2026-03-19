import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const defaultInputFile = path.join(repoRoot, "src", "data", "wikipediaFlags.json");
const inputFile = process.argv[2] ?? defaultInputFile;
const outputDir = process.argv[3] ?? path.join(repoRoot, "public", "wikipedia_flag_svgs");
// Keep concurrency low to reduce Wikimedia `HTTP 429` rate limiting.
const concurrency = Math.max(1, Number(process.argv[4] ?? 2));
const retries = Math.max(0, Number(process.argv[5] ?? 8));
const timeoutMs = Math.max(1000, Number(process.argv[6] ?? 30000));
const minFileSizeBytes = Math.max(1, Number(process.argv[7] ?? 20));

const raw = fs.readFileSync(inputFile, "utf8");
const entries = JSON.parse(raw);

if (!Array.isArray(entries)) {
	throw new Error(`Expected an array in ${inputFile}`);
}

function pngToSvgUrl(pngUrl) {
	const u = new URL(pngUrl);
	const parts = u.pathname.split("/").filter(Boolean);

	// Example:
	// /wikipedia/commons/thumb/3/36/Flag_of_Albania.svg/250px-Flag_of_Albania.svg.png
	// -> /wikipedia/commons/3/36/Flag_of_Albania.svg
	const thumbIndex = parts.lastIndexOf("thumb");
	if (thumbIndex === -1 || thumbIndex + 3 >= parts.length) {
		throw new Error(`Unexpected PNG URL path format: ${u.pathname}`);
	}

	// We expect .../<something>/commons/thumb/<a>/<b>/<file.svg>/<size>-<...>.png
	// The part just before `thumb` should be `commons`.

	const a = parts[thumbIndex + 1];
	const b = parts[thumbIndex + 2];
	const svgFile = parts[thumbIndex + 3]; // ends with ".svg"

	const svgParts = parts.slice(0, thumbIndex).concat([a, b, svgFile]);
	return `${u.origin}/${svgParts.join("/")}`;
}

function parseRetryAfterSeconds(value) {
	const v = String(value ?? "").trim();
	if (!v) return null;
	// Usually seconds; we only handle the common numeric form.
	const n = Number(v);
	if (Number.isFinite(n) && n >= 0) return n;
	return null;
}

function computeBackoffMs({ retryAfterSeconds, attempt }) {
	// Always add a minimum delay/jitter to avoid hammering during rate limit windows.
	const minDelayMs = 1000;
	const jitterMs = Math.floor(Math.random() * 350);

	if (retryAfterSeconds != null) {
		return Math.max(minDelayMs, retryAfterSeconds * 1000) + jitterMs;
	}

	// Exponential backoff (base is intentionally small).
	const baseMs = 1000;
	return baseMs * Math.pow(2, attempt) + jitterMs;
}

async function fetchTextWithRetry(url, { retries: retryCount = 8, timeoutMs: t = 30000 } = {}) {
	let lastError;
	for (let attempt = 0; attempt <= retryCount; attempt++) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), t);
		try {
			const res = await fetch(url, {
				signal: controller.signal,
				headers: {
					"User-Agent": "framer-flags/convertWikipediaPngToSvg",
					Accept: "image/svg+xml,image/*;q=0.8,*/*;q=0.1",
				},
			});

			if (!res.ok) {
				const isRetryableStatus = [429, 403, 500, 502, 503, 504].includes(res.status);
				if (isRetryableStatus && attempt < retryCount) {
					// If Wikimedia tells us when to retry, respect it.
					const retryAfterSeconds = parseRetryAfterSeconds(res.headers.get("retry-after"));
					const backoffMs = computeBackoffMs({ retryAfterSeconds, attempt });
					await new Promise((r) => setTimeout(r, backoffMs));
					continue;
				}
				throw new Error(`HTTP ${res.status} for ${url}`);
			}

			return await res.text();
		} catch (err) {
			lastError = err;
			if (attempt >= retryCount) break;
			const delay = computeBackoffMs({ retryAfterSeconds: null, attempt });
			await new Promise((r) => setTimeout(r, delay));
		} finally {
			clearTimeout(timeout);
		}
	}

	throw lastError;
}

fs.mkdirSync(outputDir, { recursive: true });

function safeFileName(code) {
	// Keep it filesystem-safe; we primarily expect codes like `US`.
	return String(code).replace(/[^a-zA-Z0-9_-]/g, "_");
}

const svgCache = new Map(); // svgUrl -> svgText (or "" for failures)
let written = 0;
let skippedExisting = 0;
let failed = 0;

const tasks = [];
const tasksByFilePath = new Map();
for (let i = 0; i < entries.length; i++) {
	const item = entries[i];
	if (!item || typeof item !== "object") continue;
	if (typeof item.pngImageUrl !== "string" || !item.pngImageUrl) continue;
	if (typeof item.code !== "string" || !item.code) continue;
	if (typeof item.type !== "string" || !item.type) continue;

	const safeName = safeFileName(item.code);
	const typeDir = path.join(outputDir, item.type);
	const filePath = path.join(typeDir, `${safeName}.svg`);

	// Ensure subfolders exist (you said they already do, but this keeps the script robust).
	fs.mkdirSync(typeDir, { recursive: true });

	// If multiple entries share the same `code` + `type`, they would collide.
	// Skip work if we already generated the file.
	if (fs.existsSync(filePath)) {
		const size = fs.statSync(filePath).size;
		if (size >= minFileSizeBytes) {
			skippedExisting++;
			continue;
		}
	}

	let svgUrl;
	try {
		svgUrl = pngToSvgUrl(item.pngImageUrl);
	} catch (err) {
		console.error(
			`Failed converting pngImageUrl to svg URL (skipping): ${item?.name ?? ""} (${item?.code ?? ""})`,
			err
		);
		failed++;
		continue;
	}

	if (!tasksByFilePath.has(filePath)) {
		tasksByFilePath.set(filePath, true);
		tasks.push({ svgUrl, filePath });
	}
}

async function writeSvgForTask(task) {
	if (fs.existsSync(task.filePath)) {
		const size = fs.statSync(task.filePath).size;
		if (size >= minFileSizeBytes) {
			skippedExisting++;
			return;
		}
	}

	if (svgCache.has(task.svgUrl)) {
		const svgText = svgCache.get(task.svgUrl);
		if (!svgText) {
			failed++;
			return;
		}
		fs.writeFileSync(task.filePath, svgText, "utf8");
		written++;
		return;
	}

	try {
		const svgText = await fetchTextWithRetry(task.svgUrl, { retries, timeoutMs });
		svgCache.set(task.svgUrl, svgText);
		fs.writeFileSync(task.filePath, svgText, "utf8");
		written++;
	} catch (err) {
		console.error(`Failed fetching SVG: ${task.svgUrl}`, err);
		svgCache.set(task.svgUrl, "");
		failed++;
	}
}

// Concurrency-limited worker pool.
let nextIndex = 0;
const workers = Array.from({ length: Math.min(concurrency, tasks.length || 1) }, () => {
	return (async () => {
		while (true) {
			const idx = nextIndex;
			nextIndex++;
			if (idx >= tasks.length) break;
			await writeSvgForTask(tasks[idx]);
		}
	})();
});

await Promise.all(workers);

console.log(`SVG output dir: ${outputDir}`);
console.log(`Entries: ${entries.length}, tasks: ${tasks.length}`);
console.log(`Written: ${written}, skippedExisting: ${skippedExisting}, failed: ${failed}`);
