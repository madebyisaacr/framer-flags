// Convert ISO code to flag emoji. [web:6][web:20]
export function codeToFlag(code: string) {
	switch (code) {
		case "england":
			return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
		case "scotland":
			return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
		case "wales":
			return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";
		default:
			return code
				.toUpperCase()
				.split("")
				.map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
				.join("");
	}
}
