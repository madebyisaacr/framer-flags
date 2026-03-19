const output = []

// Select tbody element
for (const row of $0.children) {
  const firstCell = row.firstElementChild
  const imageElement = firstCell.querySelector('img')
  const imageURL = imageElement.src
  const countryName = firstCell.children[1].firstElementChild.textContent.trim()

  output.push({
    name: countryName,
    imageURL,
  })
}

console.log(output);