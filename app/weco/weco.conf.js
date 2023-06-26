const render_fn = function(){
	weco_el.textContent = weco_el.textContent;//?? trims old tags
	weco.render.block(weco_el)
}


const link_el = document.createElement("link")
link_el.rel = "stylesheet"
document.head.appendChild(link_el)
if (weco.root)
{
	link_el.href = weco.root+'/weco/css/render/dark.weco.css';
}
else
{
	link_el.href = 'weco/css/render/dark.weco.css';
}

for (const [key, weco_el] of Object.entries(weco.els))
{
	//console.log([key,weco_el]);
	const wecoe = weco.edit(weco_el, weco.linenubers(weco.render.block));
}

//const weco_el = document.querySelector(".weco");

//const wecoe = weco.edit(weco_el, weco.linenubers(weco.render.block));






