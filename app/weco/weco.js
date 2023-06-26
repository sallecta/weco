/*local */
const local = {};
local.iv = null;
local.attempt = 1;
local.index = 0;
local.waitIndex = -1;
local.wait = false;
local.gaveup = 100;
local.wait_ms = 5,//develop in 2000
local.call = 0;
local.syncload = function syncload( a_target )
{
	local.call=local.call+1;
	var me='syncload call/try('+local.call+'/'+local.attempt+'): ';
	if ( local.attempt > local.gaveup)
	{
		//console.log(me+'gave up at: '+local.gaveup);
		clearInterval(local.iv); 
		return;
	}
	if ( !a_target[local.index] )
	{
		//console.log(me+'no more els, waiting for last el');
		if ( !local.wait )
		{
			//console.log(me+'Last el processed.');
			clearInterval(local.iv);
			//console.log(me+'Done.');
			return; 
		}
		local.attempt = local.attempt +1;
		return;
	}
	//
	if ( !local.wait )
	{
		if (local.index == local.waitIndex)
		{
			//console.log(me+'el #'+local.waitIndex+' processed, going to next');
			local.attempt = 0;
			local.index=local.index+1;
			return;
		}
		//console.log(me+'creating el #'+local.index);
		local.wait = true;
		var create_result=local.create(a_target[local.index]);//create fn here
		if (create_result)
		{
			//console.log(me+'created el #'+local.index);
		}
		else
		{
			//console.log(me+'error creating el #'+local.index);
			local.wait = false;
			local.attempt = 0;
		}
	}
	if ( local.wait )
	{
		local.attempt = local.attempt +1;
		//console.log(me+'waiting for el #'+local.index+' processed until gave up');
		if ( local.waitIndex != local.index ){ local.waitIndex = local.index; }
		return;
	}
	
	local.index=local.index+1;
	//console.log(me+'going to next el #'+local.index);
	return;
	//console.log(me+'last line ');
}

local.load = function load( a_target )
{
	var me='load: ';
	//console.log(me+'Got targets');
	local.syncload(a_target);
	local.iv= setInterval(function() {local.syncload(a_target);}, local.wait_ms);
}

local.create = function create(a_target)
{
	var me = '    _create: ';
	//console.log(...[me,a_target]);
	if ( a_target.link==null )
	{
		//console.log(me+'no link in a_target');
		return false;
	}
	//console.log(me+'creating link '+a_target.link);
	const script = document.createElement('script');
	
	script.src = a_target.link;
	
	if ( a_target.opts )
	{
		if ( a_target.opts.includes('async') )
			{ script.async = true; }
		if (a_target.opts.includes('module') )
			{ script.setAttribute('type','module'); }
	}
	
	script.onload = () => {
		//console.log(me+':ev: loaded '+script.src);
		local.wait=false;
	};
	
	script.onerror = () => {
		//console.log(me+':ev: load error '+script.src);
		script.remove();
		local.wait=false;
	};
	
	document.body.appendChild(script);
	
	return true;
}
/* end local */

const local2 = {};
local2.formSubmit = function( a_elid )
{
	event.preventDefault();
	if ( a_elid ) // called by other els
	{
		console.log(['a_elid=',a_elid]);
		var el = document.querySelector('#'+a_elid);
	}
	else
	{
		var el = event.target; // called by weco el
	}
	console.log(el);
	var myform = document.forms[el.dataset.form];// get el's form
	if ( myform )
	{
		if ( !myform.querySelector('input[name='+el.id+']') )
		{
			console.log('no');
			var input = document.createElement("input");
			input.setAttribute("type", "hidden");
			input.setAttribute("name", el.id);
			myform.appendChild(input);
		}
		else
		{
			console.log('yes');
			var input = myform.querySelector('input[name='+el.id+']');
		}
		input.setAttribute("value", el.textContent);
		console.log(input.value);
		myform.submit();
	}
}
/* end local2 */

weco ={};
weco.meta={};
weco.meta.name = 'weco';
weco.meta.version = '0.0.0';
weco.load = local.load;
weco.root = '';
weco.submit = local2.formSubmit;
weco.els = document.querySelectorAll('.weco');
//console.log(this);
	
	
	
/*
	Loading scripts
*/

weco.args=[
	{link:'weco/weco.render.js', opts:[''] },
	{link:'weco/weco.linenumbers.js', opts:[''] },
	{link:'weco/renderers/xml.renderer.weco.js', opts:[''] },
	{link:'weco/renderers/js.renderer.weco.js', opts:[''] },
	{link:'weco/renderers/php.renderer.weco.js', opts:[''] },
	{link:'weco/weco.edit.js', opts:[''] },
];
if (typeof wecoinline !== 'undefined')
{
	if (wecoinline.conf)
	{
		console.log('weco: inline configuration');
		weco.args[weco.args.length]={link:wecoinline.conf};
	}
	else
	{
		weco.args[weco.args.length]={link:'weco/weco.conf.js'};
	}
}
else
{
	weco.args[weco.args.length]={link:'weco/weco.conf.js'};
}
if (typeof wecoinline !== 'undefined')
{
	if (wecoinline.root)
	{
		//console.log('wecoinline.root');
		weco.root= wecoinline.root;
		var i = 0;
		while (i < weco.args.length)
		{
			weco.args[i].link = weco.root+'/'+weco.args[i].link;
			//console.log('wecoinline.root: link: '+weco.args[i].link);
			i++;
		}

	}
}
weco.load(weco.args);
//console.log(this);
