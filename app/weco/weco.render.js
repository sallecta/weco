/*
based on
h0ighlight.js v9.18.1 
https://www.npmjs.com/package/h0ighlight.js/v/9.18.1?activeTab=explore
BSD3 License | git.io/hljslicense 
*/

(
function(factory)
{
	weco.render = factory({}); //map all to global weco object defined in weco.js

}(function(arg_obj) {
	arg_obj.defs = {};
	// Convenience variables for build-in objects
	var ArrayProto = [],
		objectKeys = Object.keys;

	var renderers = {},
		aliases = {};

	var noHighlightRe = /^(no-?highlight|plain|text)$/i,
		rendererPrefixRe = /\brender?-([\w-]+)\b/i,
		fixMarkupRe = /((^(<[^>]+>|\t|)+|(?:\n)))/gm;

	// The object will be assigned by the build tool. It used to synchronize API
	// of external renderer files with minified version of the highlight.js library.
	var API_REPLACES;

	var spanEndTag = '</span>';
	var RENDERER_NOT_FOUND = "Could not find the renderer '{}', did you forget to add it's .js file?";

	// Global options used when within external APIs. This is modified when
	// calling the `arg_obj.configure` function.
	var options = {
		classPrefix: 'weco-',
		tabReplace: null,
		useBR: false,
		renderers: undefined
	};

	// keywords that should have no default relevance value
	var COMMON_KEYWORDS = 'of and for in not or if then'.split(' ');


	/* Utility functions */

	function escape(value) {
		return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function tag(node) {
		return node.nodeName.toLowerCase();
	}

	function testRe(re, lexeme) {
		var match = re && re.exec(lexeme);
		return match && match.index === 0;
	}

	function isNotHighlighted(renderer) {
		return noHighlightRe.test(renderer);
	}

	function blockRenderer(arg_el) {
		var i, match, length, _class;
		var el_classes = arg_el.className + ' ';

		el_classes += arg_el.parentNode ? arg_el.parentNode.className : '';
		// render-* takes precedence over non-prefixed class names.
		match = rendererPrefixRe.exec(el_classes);
		if (match) {
			var renderer = getRenderer(match[1]);
			if (!renderer) {
				console.warn(RENDERER_NOT_FOUND.replace("{}", match[1]));
				console.warn("Falling back to no-highlight mode for this arg_el.", arg_el);
			}
			return renderer ? match[1] : 'no-highlight';
		}

		el_classes = el_classes.split(/\s+/);

		for (i = 0, length = el_classes.length; i < length; i++) {
			_class = el_classes[i];

			if (isNotHighlighted(_class) || getRenderer(_class)) {
				return _class;
			}
		}
	}

	/**
	 * performs a shallow merge of multiple objects into one
	 *
	 * @arguments list of objects with properties to merge
	 * @returns a single new object
	 */
	function inherit(parent) { // inherit(parent, override_obj, override_obj, ...)
		var key;
		var result = {};
		var objects = Array.prototype.slice.call(arguments, 1);

		for (key in parent)
			result[key] = parent[key];
		objects.forEach(function(obj) {
			for (key in obj)
				result[key] = obj[key];
		});
		return result;
	}

	/* Stream merging */

	function nodeStream(node) {
		var result = [];
		(function _nodeStream(node, offset) {
			for (var child = node.firstChild; child; child = child.nextSibling) {
				if (child.nodeType === 3)
					offset += child.nodeValue.length;
				else if (child.nodeType === 1) {
					result.push({
						event: 'start',
						offset: offset,
						node: child
					});
					offset = _nodeStream(child, offset);
					// Prevent void elements from having an end tag that would actually
					// double them in the output. There are more void elements in HTML
					// but we list only those realistically expected in code display.
					if (!tag(child).match(/br|hr|img|input/)) {
						result.push({
							event: 'stop',
							offset: offset,
							node: child
						});
					}
				}
			}
			return offset;
		})(node, 0);
		return result;
	}

	function mergeStreams(original, highlighted, value) {
		var processed = 0;
		var result = '';
		var nodeStack = [];

		function selectStream() {
			if (!original.length || !highlighted.length) {
				return original.length ? original : highlighted;
			}
			if (original[0].offset !== highlighted[0].offset) {
				return (original[0].offset < highlighted[0].offset) ? original : highlighted;
			}

			/*
			To avoid starting the stream just before it should stop the order is
			ensured that original always starts first and closes last:

			if (event1 == 'start' && event2 == 'start')
			  return original;
			if (event1 == 'start' && event2 == 'stop')
			  return highlighted;
			if (event1 == 'stop' && event2 == 'start')
			  return original;
			if (event1 == 'stop' && event2 == 'stop')
			  return highlighted;

			... which is collapsed to:
			*/
			return highlighted[0].event === 'start' ? original : highlighted;
		}

		function open(node) {
			function attr_str(a) {
				return ' ' + a.nodeName + '="' + escape(a.value).replace(/"/g, '&quot;') + '"';
			}
			result += '<' + tag(node) + ArrayProto.map.call(node.attributes, attr_str).join('') + '>';
		}

		function close(node) {
			result += '</' + tag(node) + '>';
		}

		function render(event) {
			(event.event === 'start' ? open : close)(event.node);
		}

		while (original.length || highlighted.length) {
			var stream = selectStream();
			result += escape(value.substring(processed, stream[0].offset));
			processed = stream[0].offset;
			if (stream === original) {
				/*
				On any opening or closing tag of the original markup we first close
				the entire highlighted node stack, then render the original tag along
				with all the following original tags at the same offset and then
				reopen all the tags on the highlighted stack.
				*/
				nodeStack.reverse().forEach(close);
				do {
					render(stream.splice(0, 1)[0]);
					stream = selectStream();
				} while (stream === original && stream.length && stream[0].offset === processed);
				nodeStack.reverse().forEach(open);
			} else {
				if (stream[0].event === 'start') {
					nodeStack.push(stream[0].node);
				} else {
					nodeStack.pop();
				}
				render(stream.splice(0, 1)[0]);
			}
		}
		return result + escape(value.substr(processed));
	}

	/* Initialization */

	function dependencyOnParent(mode) {
		if (!mode) return false;

		return mode.endsWithParent || dependencyOnParent(mode.starts);
	}

	function expand_or_clone_mode(arg_mode)
	{
		if (arg_mode.variants && !arg_mode.cached_variants)
		{
			arg_mode.cached_variants = arg_mode.variants.map(function(variant) {
				return inherit(arg_mode, {
					variants: null
				}, variant);
			});
		}

		// EXPAND
		// if we have variants then essentially "replace" the arg_mode with the variants
		// this happens in compileMode, where this function is called from
		if (arg_mode.cached_variants)
			return arg_mode.cached_variants;

		// CLONE
		// if we have dependencies on parents then we need a unique
		// instance of ourselves, so we can be reused with many
		// different parents without issue
		if (dependencyOnParent(arg_mode))
			return [inherit(arg_mode, {
				starts: arg_mode.starts ? inherit(arg_mode.starts) : null
			})];

		if (Object.isFrozen(arg_mode))
			return [inherit(arg_mode)];

		// no special dependency issues, just return ourselves
		return [arg_mode];
	}

	function restoreRendererApi(obj) {
		if (API_REPLACES && !obj.rendApiRestored) {
			obj.rendApiRestored = true;
			for (var key in API_REPLACES) {
				if (obj[key]) {
					obj[API_REPLACES[key]] = obj[key];
				}
			}
			(obj.contains || []).concat(obj.variants || []).forEach(restoreRendererApi);
		}
	}

	function compileKeywords(rawKeywords, case_insensitive) {
		var compiled_keywords = {};

		if (typeof rawKeywords === 'string') { // string
			splitAndCompile('keyword', rawKeywords);
		} else {
			objectKeys(rawKeywords).forEach(function(className) {
				splitAndCompile(className, rawKeywords[className]);
			});
		}
		return compiled_keywords;

		// ---

		function splitAndCompile(className, str) {
			if (case_insensitive) {
				str = str.toLowerCase();
			}
			str.split(' ').forEach(function(keyword) {
				var pair = keyword.split('|');
				compiled_keywords[pair[0]] = [className, scoreForKeyword(pair[0], pair[1])];
			});
		}
	}

	function scoreForKeyword(keyword, providedScore) {
		// manual scores always win over common keywords
		// so you can force a score of 1 if you really insist
		if (providedScore)
			return Number(providedScore);

		return commonKeyword(keyword) ? 0 : 1;
	}

	function commonKeyword(word) {
		return COMMON_KEYWORDS.indexOf(word.toLowerCase()) != -1;
	}

	function compileRenderer(renderer) {

		function reStr(re) {
			return (re && re.source) || re;
		}

		function rendRe(value, global) {
			return new RegExp(
				reStr(value),
				'm' + (renderer.case_insensitive ? 'i' : '') + (global ? 'g' : '')
			);
		}

		function reCountMatchGroups(re) {
			return (new RegExp(re.toString() + '|')).exec('').length - 1;
		}

		// joinRe logically computes regexps.join(separator), but fixes the
		// backreferences so they continue to match.
		// it also places each individual regular expression into it's own
		// match group, keeping track of the sequencing of those match groups
		// is currently an exercise for the caller. :-)
		function joinRe(regexps, separator) {
			// backreferenceRe matches an open parenthesis or backreference. To avoid
			// an incorrect parse, it additionally matches the following:
			// - [...] elements, where the meaning of parentheses and escapes change
			// - other escape sequences, so we do not misparse escape sequences as
			//   interesting elements
			// - non-matching or lookahead parentheses, which do not capture. These
			//   follow the '(' with a '?'.
			var backreferenceRe = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;
			var numCaptures = 0;
			var ret = '';
			for (var i = 0; i < regexps.length; i++) {
				numCaptures += 1;
				var offset = numCaptures;
				var re = reStr(regexps[i]);
				if (i > 0) {
					ret += separator;
				}
				ret += "(";
				while (re.length > 0) {
					var match = backreferenceRe.exec(re);
					if (match == null) {
						ret += re;
						break;
					}
					ret += re.substring(0, match.index);
					re = re.substring(match.index + match[0].length);
					if (match[0][0] == '\\' && match[1]) {
						// Adjust the backreference.
						ret += '\\' + String(Number(match[1]) + offset);
					} else {
						ret += match[0];
						if (match[0] == '(') {
							numCaptures++;
						}
					}
				}
				ret += ")";
			}
			return ret;
		}

		function buildModeRegex(mode) {

			var matchIndexes = {};
			var matcherRe;
			var regexes = [];
			var matcher = {};
			var matchAt = 1;

			function addRule(rule, regex) {
				matchIndexes[matchAt] = rule;
				regexes.push([rule, regex]);
				matchAt += reCountMatchGroups(regex) + 1;
			}

			var term;
			for (var i = 0; i < mode.contains.length; i++) {
				var re;
				term = mode.contains[i];
				if (term.beginKeywords) {
					re = '\\.?(?:' + term.begin + ')\\.?';
				} else {
					re = term.begin;
				}
				addRule(term, re);
			}
			if (mode.terminator_end)
				addRule("end", mode.terminator_end);
			if (mode.illegal)
				addRule("illegal", mode.illegal);

			var terminators = regexes.map(function(el) {
				return el[1];
			});
			matcherRe = rendRe(joinRe(terminators, '|'), true);

			matcher.lastIndex = 0;
			matcher.exec = function(s) {
				var rule;

				if (regexes.length === 0) return null;

				matcherRe.lastIndex = matcher.lastIndex;
				var match = matcherRe.exec(s);
				if (!match) {
					return null;
				}

				for (var i = 0; i < match.length; i++) {
					if (match[i] != undefined && matchIndexes["" + i] != undefined) {
						rule = matchIndexes["" + i];
						break;
					}
				}

				// illegal or end match
				if (typeof rule === "string") {
					match.type = rule;
					match.extra = [mode.illegal, mode.terminator_end];
				} else {
					match.type = "begin";
					match.rule = rule;
				}
				return match;
			};

			return matcher;
		}

		function compileMode(arg_mode, parent) {
			if (arg_mode.compiled)
				return;
			arg_mode.compiled = true;

			arg_mode.keywords = arg_mode.keywords || arg_mode.beginKeywords;
			if (arg_mode.keywords)
				arg_mode.keywords = compileKeywords(arg_mode.keywords, renderer.case_insensitive);

			arg_mode.lexemesRe = rendRe(arg_mode.lexemes || /\w+/, true);

			if (parent) {
				if (arg_mode.beginKeywords) {
					arg_mode.begin = '\\b(' + arg_mode.beginKeywords.split(' ').join('|') + ')\\b';
				}
				if (!arg_mode.begin)
					arg_mode.begin = /\B|\b/;
				arg_mode.beginRe = rendRe(arg_mode.begin);
				if (arg_mode.endSameAsBegin)
					arg_mode.end = arg_mode.begin;
				if (!arg_mode.end && !arg_mode.endsWithParent)
					arg_mode.end = /\B|\b/;
				if (arg_mode.end)
					arg_mode.endRe = rendRe(arg_mode.end);
				arg_mode.terminator_end = reStr(arg_mode.end) || '';
				if (arg_mode.endsWithParent && parent.terminator_end)
					arg_mode.terminator_end += (arg_mode.end ? '|' : '') + parent.terminator_end;
			}
			if (arg_mode.illegal)
				arg_mode.illegalRe = rendRe(arg_mode.illegal);
			if (arg_mode.relevance == null)
				arg_mode.relevance = 1;
			if (!arg_mode.contains) {
				arg_mode.contains = [];
			}
			arg_mode.contains = Array.prototype.concat.apply([], arg_mode.contains.map(function(arg_c) {
				return expand_or_clone_mode(arg_c === 'self' ? arg_mode : arg_c);
			}));
			arg_mode.contains.forEach(function(c) {
				compileMode(c, arg_mode);
			});

			if (arg_mode.starts) {
				compileMode(arg_mode.starts, parent);
			}

			arg_mode.terminators = buildModeRegex(arg_mode);
		}

		// self is not valid at the top-level
		if (renderer.contains && renderer.contains.indexOf('self') != -1)
		{
			console.error("`self` is not supported at the top-level of a renderer.");
			renderer.contains = renderer.contains.filter(function(mode) {
					return mode != 'self';
				});
		}
		compileMode(renderer);
	}


	/**
	 * DOM node content rendering.
	 *
	 * @param {string} arg_renderer - the renderer to use
	 * @param {string} arg_str - string to render
	 * @param {boolean} arg_skip_illegals - whether to ignore illegal matches, default is to bail
	 * @param {array<mode>} arg_continuation - array of continuation modes
	 *
	 * @returns an object that represents the result
	 * @property {string} renderer - the renderer name
	 * @property {number} relevance - the relevance score
	 * @property {string} value - the highlighted HTML code
	 * @property {mode} top - top of the current mode stack
	 * @property {boolean} illegal - indicates whether any illegal matches were found
	 */
	function content(arg_renderer, arg_str, arg_skip_illegals, arg_continuation) {
		function escapeRe(value) {
			return new RegExp(value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'm');
		}

		function endOfMode(mode, lexeme) {
			if (testRe(mode.endRe, lexeme)) {
				while (mode.endsParent && mode.parent) {
					mode = mode.parent;
				}
				return mode;
			}
			if (mode.endsWithParent) {
				return endOfMode(mode.parent, lexeme);
			}
		}

		function keywordMatch(mode, match) {
			var match_str = renderer.case_insensitive ? match[0].toLowerCase() : match[0];
			return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
		}

		function buildSpan(className, insideSpan, leaveOpen, noPrefix) {
			if (!leaveOpen && insideSpan === '') return '';
			if (!className) return insideSpan;

			var classPrefix = noPrefix ? '' : options.classPrefix,
				openSpan = '<span class="' + classPrefix,
				closeSpan = leaveOpen ? '' : spanEndTag;

			openSpan += className + '">';

			return openSpan + insideSpan + closeSpan;
		}

		function processKeywords() {
			var keyword_match, last_index, match, result;

			if (!top.keywords)
				return escape(mode_buffer);

			result = '';
			last_index = 0;
			top.lexemesRe.lastIndex = 0;
			match = top.lexemesRe.exec(mode_buffer);

			while (match) {
				result += escape(mode_buffer.substring(last_index, match.index));
				keyword_match = keywordMatch(top, match);
				if (keyword_match) {
					relevance += keyword_match[1];
					result += buildSpan(keyword_match[0], escape(match[0]));
				} else {
					result += escape(match[0]);
				}
				last_index = top.lexemesRe.lastIndex;
				match = top.lexemesRe.exec(mode_buffer);
			}
			return result + escape(mode_buffer.substr(last_index));
		}

		function processSubRenderer() {
			var explicit = typeof top.subRenderer === 'string';
			if (explicit && !renderers[top.subRenderer]) {
				return escape(mode_buffer);
			}

			var result = explicit ?
				content(top.subRenderer, mode_buffer, true, continuations[top.subRenderer]) :
				auto(mode_buffer, top.subRenderer.length ? top.subRenderer : undefined);

			// Counting embedded renderer score towards the host renderer may be disabled
			// with zeroing the containing mode relevance. Use case in point is Markdown that
			// allows XML everywhere and makes every XML snippet to have a much larger Markdown
			// score.
			if (top.relevance > 0) {
				relevance += result.relevance;
			}
			if (explicit) {
				continuations[top.subRenderer] = result.top;
			}
			return buildSpan(result.renderer, result.value, false, true);
		}

		function processBuffer() {
			result += (top.subRenderer != null ? processSubRenderer() : processKeywords());
			mode_buffer = '';
		}

		function startNewMode(mode) {
			result += mode.className ? buildSpan(mode.className, '', true) : '';
			top = Object.create(mode, {
				parent: {
					value: top
				}
			});
		}


		function doBeginMatch(match) {
			var lexeme = match[0];
			var new_mode = match.rule;

			if (new_mode && new_mode.endSameAsBegin) {
				new_mode.endRe = escapeRe(lexeme);
			}

			if (new_mode.skip) {
				mode_buffer += lexeme;
			} else {
				if (new_mode.excludeBegin) {
					mode_buffer += lexeme;
				}
				processBuffer();
				if (!new_mode.returnBegin && !new_mode.excludeBegin) {
					mode_buffer = lexeme;
				}
			}
			startNewMode(new_mode);
			return new_mode.returnBegin ? 0 : lexeme.length;
		}

		function doEndMatch(match) {
			var lexeme = match[0];
			var matchPlusRemainder = arg_str.substr(match.index);
			var end_mode = endOfMode(top, matchPlusRemainder);
			if (!end_mode) {
				return;
			}

			var origin = top;
			if (origin.skip) {
				mode_buffer += lexeme;
			} else {
				if (!(origin.returnEnd || origin.excludeEnd)) {
					mode_buffer += lexeme;
				}
				processBuffer();
				if (origin.excludeEnd) {
					mode_buffer = lexeme;
				}
			}
			do {
				if (top.className) {
					result += spanEndTag;
				}
				if (!top.skip && !top.subRenderer) {
					relevance += top.relevance;
				}
				top = top.parent;
			} while (top !== end_mode.parent);
			if (end_mode.starts) {
				if (end_mode.endSameAsBegin) {
					end_mode.starts.endRe = end_mode.endRe;
				}
				startNewMode(end_mode.starts);
			}
			return origin.returnEnd ? 0 : lexeme.length;
		}

		var lastMatch = {};

		function processLexeme(text_before_match, match) {

			var lexeme = match && match[0];

			// add non-matched text to the current mode buffer
			mode_buffer += text_before_match;

			if (lexeme == null) {
				processBuffer();
				return 0;
			}

			// we've found a 0 width match and we're stuck, so we need to advance
			// this happens when we have badly behaved rules that have optional matchers to the degree that
			// sometimes they can end up matching nothing at all
			// Ref: https://github.com/highlightjs/highlight.js/issues/2140
			if (lastMatch.type == "begin" && match.type == "end" && lastMatch.index == match.index && lexeme === "") {
				// spit the "skipped" character that our regex choked on back into the output sequence
				mode_buffer += arg_str.slice(match.index, match.index + 1);
				return 1;
			}
			lastMatch = match;

			if (match.type === "begin") {
				return doBeginMatch(match);
			} else if (match.type === "illegal" && !arg_skip_illegals) {
				// illegal match, we do not continue processing
				throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');
			} else if (match.type === "end") {
				var processed = doEndMatch(match);
				if (processed != undefined)
					return processed;
			}

			/*
			Why might be find ourselves here?  Only one occasion now.  An end match that was
			triggered but could not be completed.  When might this happen?  When an `endSameasBegin`
			rule sets the end rule to a specific match.  Since the overall mode termination rule that's
			being used to scan the text isn't recompiled that means that any match that LOOKS like
			the end (but is not, because it is not an exact match to the beginning) will
			end up here.  A definite end match, but when `doEndMatch` tries to "reapply"
			the end rule and fails to match, we wind up here, and just silently ignore the end.

			This causes no real harm other than stopping a few times too many.
			*/

			mode_buffer += lexeme;
			return lexeme.length;
		}

		var renderer = getRenderer(arg_renderer);
		if (!renderer) {
			console.error(RENDERER_NOT_FOUND.replace("{}", arg_renderer));
			throw new Error('Unknown renderer: "' + arg_renderer + '"');
		}

		compileRenderer(renderer);
		var top = arg_continuation || renderer;
		var continuations = {}; // keep continuations for sub-renderers
		var result = '',
			current;
		for (current = top; current !== renderer; current = current.parent) {
			if (current.className) {
				result = buildSpan(current.className, '', true) + result;
			}
		}
		var mode_buffer = '';
		var relevance = 0;
		try {
			var match, count, index = 0;
			while (true) {
				top.terminators.lastIndex = index;
				match = top.terminators.exec(arg_str);
				if (!match)
					break;
				count = processLexeme(arg_str.substring(index, match.index), match);
				index = match.index + count;
			}
			processLexeme(arg_str.substr(index));
			for (current = top; current.parent; current = current.parent) { // close dangling modes
				if (current.className) {
					result += spanEndTag;
				}
			}
			return {
				relevance: relevance,
				value: result,
				illegal: false,
				renderer: arg_renderer,
				top: top
			};
		} catch (err) {
			if (err.message && err.message.indexOf('Illegal') !== -1) {
				return {
					illegal: true,
					relevance: 0,
					value: escape(arg_str)
				};
			} else {
				console.error(err);
				return {
					relevance: 0,
					value: escape(arg_str),
					renderer: arg_renderer,
					top: top,
					errorRaised: err
				};
			}
		}
	}


	function auto(code, rendererSubset) {
		rendererSubset = rendererSubset || options.renderers || objectKeys(renderers);
		var result = {
			relevance: 0,
			value: escape(code)
		};
		var second_best = result;
		rendererSubset.filter(getRenderer).filter(autoDetection).forEach(function(name) {
			var current = content(name, code, false);
			current.renderer = name;
			if (current.relevance > second_best.relevance) {
				second_best = current;
			}
			if (current.relevance > result.relevance) {
				second_best = result;
				result = current;
			}
		});
		if (second_best.renderer) {
			result.second_best = second_best;
		}
		return result;
	}

	/*
	Post-processing of the highlighted markup:

	- replace TABs with something more useful
	- replace real line-breaks with '<br>' for non-pre containers

	*/
	function fixMarkup(value) {
		if (!(options.tabReplace || options.useBR)) {
			return value;
		}

		return value.replace(fixMarkupRe, function(match, p1) {
			if (options.useBR && match === '\n') {
				return '<br>';
			} else if (options.tabReplace) {
				return p1.replace(/\t/g, options.tabReplace);
			}
			return '';
		});
	}

	function buildClassName(prevClassName, currentSntx, resultSntx) {
		var renderer = currentSntx ? aliases[currentSntx] : resultSntx,
			result = [prevClassName.trim()];

		if (!prevClassName.match(/\bweco\b/)) {
			result.push('weco');
		}

		if (prevClassName.indexOf(renderer) === -1) {
			result.push(renderer);
		}

		return result.join(' ').trim();
	}

	/*
	Applies highlighting to a DOM node containing code. Accepts a DOM node and
	two optional parameters for fixMarkup.
	*/
	function block(arg_el) {
		var node, originalStream, result, resultNode, text;
		var renderer = blockRenderer(arg_el);
		if (isNotHighlighted(renderer))
			return;

		if (options.useBR) {
			node = document.createElement('div');
			node.innerHTML = arg_el.innerHTML.replace(/\n/g, '').replace(/<br[ \/]*>/g, '\n');
		} else {
			node = arg_el;
		}
		text = node.textContent;
		result = renderer ? content(renderer, text, true) : auto(text);

		originalStream = nodeStream(node);
		if (originalStream.length) {
			resultNode = document.createElement('div');
			resultNode.innerHTML = result.value;
			result.value = mergeStreams(originalStream, nodeStream(resultNode), text);
		}
		result.value = fixMarkup(result.value);

		arg_el.innerHTML = result.value;
		arg_el.className = buildClassName(arg_el.className, renderer, result.renderer);
		arg_el.result = {
			renderer: result.renderer,
			re: result.relevance
		};
		if (result.second_best) {
			arg_el.second_best = {
				renderer: result.second_best.renderer,
				re: result.second_best.relevance
			};
		}
		arg_el.style.lineHeight = '1.5em';
		arg_el.style.padding = '0.5em';
		arg_el.style.paddingLeft = '2.5em';
	}

	function configure(user_options) {
		options = inherit(options, user_options);
	}

	/*
	Renders all <pre><code>..</code></pre> blocks on a page.
	*/
	function pre_code() {
		if (pre_code.called)
			return;
		pre_code.called = true;

		var blocks = document.querySelectorAll('pre code');
		ArrayProto.forEach.call(blocks, block);
	}

	/*
	Attaches highlighting to the page load event.
	*/
	function pre_code_on_load() {
		window.addEventListener('DOMContentLoaded', pre_code, false);
		window.addEventListener('load', pre_code, false);
	}

	var PLAINTEXT_RENDERER = {
		disableAutodetect: true
	};

	function registerRenderer(arg_name, arg_renderer) {
		var rend;
		try
		{
			rend = arg_renderer(arg_obj);
		}
		catch (error)
		{
			console.error("Renderer definition for '{}' could not be registered.".replace("{}", arg_name));
			console.error(error);
			rend = PLAINTEXT_RENDERER;
		}
		renderers[arg_name] = rend;
		restoreRendererApi(rend);
		rend.rawDefinition = arg_renderer.bind(null, arg_obj);

		if (rend.aliases) {
			rend.aliases.forEach(function(alias) {
				aliases[alias] = arg_name;
			});
		}
	}

	function listRenderers() {
		return objectKeys(renderers);
	}

	/*
	  intended usage: When one renderer truly requires another

	  Unlike `getRenderer`, this will throw when the requested renderer
	  is not available.
	*/
	function requireRenderer(arg_name) {
		var rend = getRenderer(arg_name);
		if (rend) {
			return rend;
		}

		var err = new Error('The \'{}\' renderer is required, but not loaded.'.replace('{}', arg_name));
		throw err;
	}

	function getRenderer(name) {
		name = (name || '').toLowerCase();
		return renderers[name] || renderers[aliases[name]];
	}

	function autoDetection(name) {
		var rend = getRenderer(name);
		result = rend && !rend.disableAutodetect;
		console.log(['autoDetection result',result]);
		return rend && !rend.disableAutodetect;
	}

	/* Interface definition */

	arg_obj.content = content;
	arg_obj.auto = auto;
	arg_obj.fixMarkup = fixMarkup;
	arg_obj.block = block;
	arg_obj.configure = configure;
	arg_obj.pre_code = pre_code;
	arg_obj.pre_code_on_load = pre_code_on_load;
	arg_obj.registerRenderer = registerRenderer;
	arg_obj.listRenderers = listRenderers;
	arg_obj.getRenderer = getRenderer;
	arg_obj.requireRenderer = requireRenderer;
	arg_obj.autoDetection = autoDetection;
	arg_obj.inherit = inherit;

	// Common regexps
	arg_obj.defs.IDENT_RE = '[a-zA-Z]\\w*';
	arg_obj.defs.UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
	arg_obj.defs.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
	arg_obj.defs.C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
	arg_obj.defs.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
	arg_obj.defs.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

	// Common modes
	arg_obj.defs.BACKSLASH_ESCAPE = {
		begin: '\\\\[\\s\\S]',
		relevance: 0
	};
	arg_obj.defs.APOS_STRING_MODE = {
		className: 'string',
		begin: '\'',
		end: '\'',
		illegal: '\\n',
		contains: [arg_obj.defs.BACKSLASH_ESCAPE]
	};
	arg_obj.defs.QUOTE_STRING_MODE = {
		className: 'string',
		begin: '"',
		end: '"',
		illegal: '\\n',
		contains: [arg_obj.defs.BACKSLASH_ESCAPE]
	};
	arg_obj.defs.PHRASAL_WORDS_MODE = {
		begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
	};
	arg_obj.defs.COMMENT = function(begin, end, inherits) {
		var mode = arg_obj.inherit({
				className: 'comment',
				begin: begin,
				end: end,
				contains: []
			},
			inherits || {}
		);
		mode.contains.push(arg_obj.defs.PHRASAL_WORDS_MODE);
		mode.contains.push({
			className: 'doctag',
			begin: '(?:TODO|FIXME|NOTE|BUG|XXX):',
			relevance: 0
		});
		return mode;
	};
	arg_obj.defs.C_LINE_COMMENT_MODE = arg_obj.defs.COMMENT('//', '$');
	arg_obj.defs.C_BLOCK_COMMENT_MODE = arg_obj.defs.COMMENT('/\\*', '\\*/');
	arg_obj.defs.HASH_COMMENT_MODE = arg_obj.defs.COMMENT('#', '$');
	arg_obj.defs.NUMBER_MODE = {
		className: 'number',
		begin: arg_obj.defs.NUMBER_RE,
		relevance: 0
	};
	arg_obj.defs.C_NUMBER_MODE = {
		className: 'number',
		begin: arg_obj.defs.C_NUMBER_RE,
		relevance: 0
	};
	arg_obj.defs.BINARY_NUMBER_MODE = {
		className: 'number',
		begin: arg_obj.defs.BINARY_NUMBER_RE,
		relevance: 0
	};
	arg_obj.defs.CSS_NUMBER_MODE = {
		className: 'number',
		begin: arg_obj.defs.NUMBER_RE + '(' +
			'%|em|ex|ch|rem' +
			'|vw|vh|vmin|vmax' +
			'|cm|mm|in|pt|pc|px' +
			'|deg|grad|rad|turn' +
			'|s|ms' +
			'|Hz|kHz' +
			'|dpi|dpcm|dppx' +
			')?',
		relevance: 0
	};
	arg_obj.defs.REGEXP_MODE = {
		className: 'regexp',
		begin: /\//,
		end: /\/[gimuy]*/,
		illegal: /\n/,
		contains: [
			arg_obj.defs.BACKSLASH_ESCAPE,
			{
				begin: /\[/,
				end: /\]/,
				relevance: 0,
				contains: [arg_obj.defs.BACKSLASH_ESCAPE]
			}
		]
	};
	arg_obj.defs.TITLE_MODE = {
		className: 'title',
		begin: arg_obj.defs.IDENT_RE,
		relevance: 0
	};
	arg_obj.defs.UNDERSCORE_TITLE_MODE = {
		className: 'title',
		begin: arg_obj.defs.UNDERSCORE_IDENT_RE,
		relevance: 0
	};
	arg_obj.defs.METHOD_GUARD = {
		// excludes method names from keyword processing
		begin: '\\.\\s*' + arg_obj.defs.UNDERSCORE_IDENT_RE,
		relevance: 0
	};
	
	return arg_obj;
}
)
)
