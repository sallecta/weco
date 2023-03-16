const render_fn = function(){
	weco_el.textContent = weco_el.textContent;//?? trims old tags
	weco.render.block(weco_el)
}


const link_el = document.createElement("link")
link_el.rel = "stylesheet"
document.head.appendChild(link_el)
link_el.href = `weco/css/render/dark.weco.css`

const weco_el = document.querySelector(".weco");

const wecoe = weco.edit(weco_el, weco.linenubers(weco.render.block));






