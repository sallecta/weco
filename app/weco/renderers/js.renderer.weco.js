/*
Renderer: JavaScript
Description: JavaScript (JS) is a lightweight(:D), interpreted, or just-in-time compiled programming language with first-class functions.
Category: common, scripting
Website: https://developer.mozilla.org/en-US/docs/Web/JavaScript
*/

renderer = function(arg_obj) {
	var FRAGMENT = {
		begin: '<>',
		end: '</>'
	};
	var XML_TAG = {
		begin: /<[A-Za-z0-9\\._:-]+/,
		end: /\/[A-Za-z0-9\\._:-]+>|\/>/
	};
	var IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
	var KEYWORDS = {
		keyword: 'in of if for while finally var new function do return void else break catch ' +
			'instanceof with throw case default try this switch continue typeof delete ' +
			'let yield const export super debugger as async await static ' +
			// ECMAScript 6 modules import
			'import from as',
		literal: 'true false null undefined NaN Infinity',
		built_in: 'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
			'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
			'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
			'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
			'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
			'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
			'module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect ' +
			'Promise'
	};
	var NUMBER = {
		className: 'number',
		variants: [{
				begin: '\\b(0[bB][01]+)n?'
			},
			{
				begin: '\\b(0[oO][0-7]+)n?'
			},
			{
				begin: arg_obj.defs.C_NUMBER_RE + 'n?'
			}
		],
		relevance: 0
	};
	var SUBST = {
		className: 'subst',
		begin: '\\$\\{',
		end: '\\}',
		keywords: KEYWORDS,
		contains: [] // defined later
	};
	var HTML_TEMPLATE = {
		begin: 'html`',
		end: '',
		starts: {
			end: '`',
			returnEnd: false,
			contains: [
				arg_obj.defs.BACKSLASH_ESCAPE,
				SUBST
			],
			subLanguage: 'xml',
		}
	};
	var CSS_TEMPLATE = {
		begin: 'css`',
		end: '',
		starts: {
			end: '`',
			returnEnd: false,
			contains: [
				arg_obj.defs.BACKSLASH_ESCAPE,
				SUBST
			],
			subLanguage: 'css',
		}
	};
	var TEMPLATE_STRING = {
		className: 'string',
		begin: '`',
		end: '`',
		contains: [
			arg_obj.defs.BACKSLASH_ESCAPE,
			SUBST
		]
	};
	SUBST.contains = [
		arg_obj.defs.APOS_STRING_MODE,
		arg_obj.defs.QUOTE_STRING_MODE,
		HTML_TEMPLATE,
		CSS_TEMPLATE,
		TEMPLATE_STRING,
		NUMBER,
		arg_obj.defs.REGEXP_MODE
	];
	var PARAMS_CONTAINS = SUBST.contains.concat([
		arg_obj.defs.C_BLOCK_COMMENT_MODE,
		arg_obj.defs.C_LINE_COMMENT_MODE
	]);

	return {
		aliases: ['js', 'jsx', 'mjs', 'cjs'],
		keywords: KEYWORDS,
		contains: [{
				className: 'meta',
				relevance: 10,
				begin: /^\s*['"]use (strict|asm)['"]/
			},
			{
				className: 'meta',
				begin: /^#!/,
				end: /$/
			},
			arg_obj.defs.APOS_STRING_MODE,
			arg_obj.defs.QUOTE_STRING_MODE,
			HTML_TEMPLATE,
			CSS_TEMPLATE,
			TEMPLATE_STRING,
			arg_obj.defs.C_LINE_COMMENT_MODE,
			arg_obj.defs.COMMENT(
				'/\\*\\*',
				'\\*/', {
					relevance: 0,
					contains: [{
						className: 'doctag',
						begin: '@[A-Za-z]+',
						contains: [{
								className: 'type',
								begin: '\\{',
								end: '\\}',
								relevance: 0
							},
							{
								className: 'variable',
								begin: IDENT_RE + '(?=\\s*(-)|$)',
								endsParent: true,
								relevance: 0
							},
							// eat spaces (not newlines) so we can find
							// types or variables
							{
								begin: /(?=[^\n])\s/,
								relevance: 0
							},
						]
					}]
				}
			),
			arg_obj.defs.C_BLOCK_COMMENT_MODE,
			NUMBER,
			{ // object attr container
				begin: /[{,\n]\s*/,
				relevance: 0,
				contains: [{
					begin: IDENT_RE + '\\s*:',
					returnBegin: true,
					relevance: 0,
					contains: [{
						className: 'attr',
						begin: IDENT_RE,
						relevance: 0
					}]
				}]
			},
			{ // "value" container
				begin: '(' + arg_obj.defs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
				keywords: 'return throw case',
				contains: [
					arg_obj.defs.C_LINE_COMMENT_MODE,
					arg_obj.defs.C_BLOCK_COMMENT_MODE,
					arg_obj.defs.REGEXP_MODE,
					{
						className: 'function',
						begin: '(\\(.*?\\)|' + IDENT_RE + ')\\s*=>',
						returnBegin: true,
						end: '\\s*=>',
						contains: [{
							className: 'params',
							variants: [{
									begin: IDENT_RE
								},
								{
									begin: /\(\s*\)/,
								},
								{
									begin: /\(/,
									end: /\)/,
									excludeBegin: true,
									excludeEnd: true,
									keywords: KEYWORDS,
									contains: PARAMS_CONTAINS
								}
							]
						}]
					},
					{
						className: '',
						begin: /\s/,
						end: /\s*/,
						skip: true,
					},
					{ // JSX
						variants: [{
								begin: FRAGMENT.begin,
								end: FRAGMENT.end
							},
							{
								begin: XML_TAG.begin,
								end: XML_TAG.end
							}
						],
						subLanguage: 'xml',
						contains: [{
							begin: XML_TAG.begin,
							end: XML_TAG.end,
							skip: true,
							contains: ['self']
						}]
					},
				],
				relevance: 0
			},
			{
				className: 'function',
				beginKeywords: 'function',
				end: /\{/,
				excludeEnd: true,
				contains: [
					arg_obj.inherit(arg_obj.defs.TITLE_MODE, {
						begin: IDENT_RE
					}),
					{
						className: 'params',
						begin: /\(/,
						end: /\)/,
						excludeBegin: true,
						excludeEnd: true,
						contains: PARAMS_CONTAINS
					}
				],
				illegal: /\[|%/
			},
			{
				begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
			},
			arg_obj.defs.METHOD_GUARD,
			{ // ES6 class
				className: 'class',
				beginKeywords: 'class',
				end: /[{;=]/,
				excludeEnd: true,
				illegal: /[:"\[\]]/,
				contains: [{
						beginKeywords: 'extends'
					},
					arg_obj.defs.UNDERSCORE_TITLE_MODE
				]
			},
			{
				beginKeywords: 'constructor get set',
				end: /\{/,
				excludeEnd: true
			}
		],
		illegal: /#(?!!)/
	};
}

weco.render.registerRenderer('js', renderer);
delete renderer;
