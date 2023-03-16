const highlight = edit => {
	// highlight.js does not trims old tags,
	// let's do it by this hack.
	weco_el.textContent = weco_el.textContent
	weco.render.block(weco_el)
}

const weco_el = document.querySelector(".weco")
const wecoe = weco.edit(weco_el, weco.linenubers(highlight))
let themeIndex = 0

const themes = [
	"light",
	"dark",
]
const themes_links=themes.map(
	name => {
		const link_el = document.createElement("link")
		link_el.href = `weco/css/render/${name}.weco.css`
		link_el.rel = "stylesheet"
		link_el.disabled = "true"
		document.head.appendChild(link_el)
		link_el.onerror = () => {
			console.log(me+'error loading '+link_el.href);
			themeButton.textContent = name+' (missing)';
			return null;
		};
		return link_el
	}
)


const themeButton = document.querySelector(".switch-theme")
if ( themeButton.textContent && themes.includes(themeButton.textContent) )
{
	themes[themeIndex].removeAttribute("disabled")
}
else if ( themeButton.textContent && !themes.includes(themeButton.textContent)  )
{
	themeButton.textContent = themeButton.textContent+' (missing)';
}
else if ( !themeButton.textContent )
{
	themeButton.textContent = 'null theme';
}

themeButton.addEventListener("click", event => {
	event.preventDefault()

	themes_links[themeIndex].setAttribute("disabled", "true")
	themeIndex = (themeIndex + 1) % themes_links.length
	themes_links[themeIndex].removeAttribute("disabled")
	name = themes[themeIndex]
	themeButton.textContent = name
})

let exampleIndex = 0
const examples = [
	function () {
		weco_el.className = "weco render-js"
		wecoe.updateCode(`
			/* https://github.com/pkellz/devsage/blob/master/Javascript/BuildJQuery.js */
			function $(selector) {
				const self = {
					element: document.querySelector(selector),
					html: () => self.element,
					on: (event, callback) => {
						self.element.addEventListener(event, callback)
					},
					hide: () => {
						self.element.style.display = 'none'
					},
					attr: (name, value) => {
						if (value == null)
							return self.element.getAttribute(name)
						else
							self.element.setAttribute(name, value)
					}
				}
			
				return self
			}
			
			// Example library calls
			$('h1').attr('class', 'new-class')
			
			console.log($('h1').attr('class'))
			
			$('h2').hide()
			
			$('h3').on('click', function() {
				alert("I was clicked")
			})
		`)
		wecoe.updateOptions({tab: "\t"})
	},

	function() {
		weco_el.className = "weco render-php"
		wecoe.updateCode(`
			<?php
			class SimpleClass
			{
			    // property declaration
			    public $var = 'a default value';
			
			    // method declaration
			    public function displayVar() {
			        echo $this->var;
			    }
			}
			?>
		`)
		wecoe.updateOptions({
			tab: "  "
		})
	},
	function() {
		weco_el.className = "weco render-html"
		wecoe.updateCode(`
			<!DOCTYPE html>
			<html>
				<head>
					<meta charset="UTF-8">
					<title>Title of the document</title>
				</head>
				<body>
					Content of the document...
				</body>
			</html>
		`)
		wecoe.updateOptions({
			tab: "\t"
		})
	},
]

examples[exampleIndex]()

const exampleButton = document.querySelector(".code_example")
exampleButton.addEventListener("click", event => {
	event.preventDefault()
	exampleIndex = (exampleIndex + 1) % examples.length
	examples[exampleIndex]()
	const [, name] = weco_el.className.match(/render-(\w+)/)
	exampleButton.textContent = name
})

