/*https://www.npmjs.com/package/wecoe/v/3.7.0?activeTab=explore*/
weco.linenubers = function linenubers(arg_func, arg_options = {}) {
	//console.log(['arg_func is',arg_func]);
	//console.log(['arg_options is',arg_options]);
	const opts = Object.assign({
		wrapClass: "weco-render-linenumbers",
		class: "linenumbers",
		width: "1.5em",
		backgroundColor: 'rgba(0, 0, 0, 0.55)',
		color: "rgba(253, 253, 253, 0.54)",
		lineHeight:"1.5em",
		padding:"0.5em",
		}, arg_options);
	let nubers_el;
	return function(arg_el) {
		//console.log(['arg_el is',arg_el]);
		arg_func(arg_el);
		if (!nubers_el) {
			nubers_el = init(arg_el, opts);
			arg_el.addEventListener("scroll", () => nubers_el.style.top = `-${arg_el.scrollTop}px`);
		}
		const code = arg_el.textContent || "";
		//const linesCount = code.replace(/\n+$/, "\n").split("\n").length + 1;
		const linesCount = count_lines(code) +1;
		var text = "";
		for (var i = 1; i < linesCount; i++) {
			text += `${i}\n`;
		}
		nubers_el.innerText = text;
	};
}

const init = function init(arg_el, arg_opts) {
	//console.log(['arg_el is',arg_el]);
	const wrap = document.createElement("div");
	wrap.className = arg_opts.wrapClass + ' deprecated';
	wrap.style.position = "relative";
	const container_el = document.createElement("div");
	container_el.className = arg_opts.class;
	wrap.appendChild(container_el);
	// Add own styles
	container_el.style.position = "absolute";
	container_el.style.top = "0px";
	container_el.style.left = "0px";
	container_el.style.bottom = "0px";
	container_el.style.width = arg_opts.width;
	container_el.style.overflow = "hidden";
	container_el.style.backgroundColor = arg_opts.backgroundColor;
	container_el.style.color = arg_opts.color;
	container_el.style.lineHeight = arg_opts.lineHeight;
	container_el.style.padding = arg_opts.padding;
	container_el.style.setProperty("mix-blend-mode", "difference");
	// Add line numbers element
	const nubers_el = document.createElement("div");
	nubers_el.style.position = "relative";
	nubers_el.style.top = "0px";
	container_el.appendChild(nubers_el);
	// Tweak arg_el styles
	arg_el.style.paddingLeft = `calc(${arg_opts.width} + ${container_el.style.paddingLeft})`;
	arg_el.style.whiteSpace = "pre";
	// Swap arg_el with a wrap
	arg_el.parentNode.insertBefore(wrap, arg_el);
	wrap.appendChild(arg_el);
	return nubers_el;
}

const count_lines = function( arg_str )
{
	var count = 1;
	for(var i = 0; i < arg_str.length; ++i)
	{
		if(arg_str[i] == "\n")
		count++;
	}
	return count;
}
