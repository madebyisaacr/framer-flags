const output = [];

for (const child of $0.children) {
	const imageURL = child.querySelector("img").src;
	const name = child.firstElementChild.children[1].firstElementChild.firstElementChild.textContent
		.trim()
		.replace("Flag of ", "");

	output.push({
		name,
		imageURL,
	});
}

console.log(output);
