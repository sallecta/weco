/*

https://www.npmjs.com/package/codejar/v/3.7.0?activeTab=explore

 */
//const globalWindow = window;
weco.edit = function edit(arg_el, arg_render, arg_opt = {}) {
	//console.log('called');
	const options = Object.assign({
		tab: '\t',
		indentOn: /[({\[]$/,
		moveToNewLine: /^[)}\]]/,
		spellcheck: false,
		catchTab: true,
		preserveIdent: true,
		addClosing: true,
		history: true,
		//window: globalWindow
	}, arg_opt);
	//const window = options.window;
	const document = window.document;
	let listeners = [];
	let history = [];
	let at = -1;
	let focus = false;
	let callback;
	let prev; // code content prior keydown event
	arg_el.setAttribute('contenteditable', 'plaintext-only');
	arg_el.setAttribute('spellcheck', options.spellcheck ? 'true' : 'false');
	arg_el.style.outline = 'none';
	arg_el.style.overflowWrap = 'break-word';
	arg_el.style.overflowY = 'auto';
	arg_el.style.whiteSpace = 'pre-wrap';
	let isLegacy = false; // true if plaintext-only is not supported
	//console.log('rendering');
	arg_render(arg_el);
	if (arg_el.contentEditable !== 'plaintext-only')
		isLegacy = true;
	if (isLegacy)
		arg_el.setAttribute('contenteditable', 'true');
	const debounceHighlight = debounce(() => {
		const pos = save();
		arg_render(arg_el, pos);
		restore(pos);
	}, 30);
	let recording = false;
	const shouldRecord = (event) => {
		return !isUndo(event) && !isRedo(event) &&
			event.key !== 'Meta' &&
			event.key !== 'Control' &&
			event.key !== 'Alt' &&
			!event.key.startsWith('Arrow');
	};
	const debounceRecordHistory = debounce((event) => {
		if (shouldRecord(event)) {
			recordHistory();
			recording = false;
		}
	}, 300);
	const on = (type, fn) => {
		listeners.push([type, fn]);
		arg_el.addEventListener(type, fn);
	};
	on('keydown', event => {
		if (event.defaultPrevented)
			return;
		prev = toString();
		if (options.preserveIdent)
			handleNewLine(event);
		else
			legacyNewLineFix(event);
		if (options.catchTab)
			handleTabCharacters(event);
		if (options.addClosing)
			handleSelfClosingCharacters(event);
		if (options.history) {
			handleUndoRedo(event);
			if (shouldRecord(event) && !recording) {
				recordHistory();
				recording = true;
			}
		}
		if (isLegacy && !isCopy(event))
			restore(save());
	});
	on('keyup', event => {
		if (event.defaultPrevented)
			return;
		if (event.isComposing)
			return;
		if (prev !== toString())
			debounceHighlight();
		debounceRecordHistory(event);
		if (callback)
			callback(toString());
	});
	on('focus', _event => {
		focus = true;
	});
	on('blur', _event => {
		focus = false;
	});
	on('paste', event => {
		recordHistory();
		handlePaste(event);
		recordHistory();
		if (callback)
			callback(toString());
	});

	function save() {
		const s = getSelection();
		const pos = {
			start: 0,
			end: 0,
			dir: undefined
		};
		let {
			anchorNode,
			anchorOffset,
			focusNode,
			focusOffset
		} = s;
		if (!anchorNode || !focusNode)
			throw 'error1';
		// If the anchor and focus are the arg_el element, return either a full
		// arg_render or a start/end cursor position depending on the selection
		if (anchorNode === arg_el && focusNode === arg_el) {
			pos.start = (anchorOffset > 0 && arg_el.textContent) ? arg_el.textContent.length : 0;
			pos.end = (focusOffset > 0 && arg_el.textContent) ? arg_el.textContent.length : 0;
			pos.dir = (focusOffset >= anchorOffset) ? '->' : '<-';
			return pos;
		}
		// Selection anchor and focus are expected to be text nodes,
		// so normalize them.
		if (anchorNode.nodeType === Node.ELEMENT_NODE) {
			const node = document.createTextNode('');
			anchorNode.insertBefore(node, anchorNode.childNodes[anchorOffset]);
			anchorNode = node;
			anchorOffset = 0;
		}
		if (focusNode.nodeType === Node.ELEMENT_NODE) {
			const node = document.createTextNode('');
			focusNode.insertBefore(node, focusNode.childNodes[focusOffset]);
			focusNode = node;
			focusOffset = 0;
		}
		visit(arg_el, el => {
			if (el === anchorNode && el === focusNode) {
				pos.start += anchorOffset;
				pos.end += focusOffset;
				pos.dir = anchorOffset <= focusOffset ? '->' : '<-';
				return 'stop';
			}
			if (el === anchorNode) {
				pos.start += anchorOffset;
				if (!pos.dir) {
					pos.dir = '->';
				} else {
					return 'stop';
				}
			} else if (el === focusNode) {
				pos.end += focusOffset;
				if (!pos.dir) {
					pos.dir = '<-';
				} else {
					return 'stop';
				}
			}
			if (el.nodeType === Node.TEXT_NODE) {
				if (pos.dir != '->')
					pos.start += el.nodeValue.length;
				if (pos.dir != '<-')
					pos.end += el.nodeValue.length;
			}
		});
		// collapse empty text nodes
		arg_el.normalize();
		return pos;
	}

	function restore(pos) {
		const s = getSelection();
		let startNode, startOffset = 0;
		let endNode, endOffset = 0;
		if (!pos.dir)
			pos.dir = '->';
		if (pos.start < 0)
			pos.start = 0;
		if (pos.end < 0)
			pos.end = 0;
		// Flip start and end if the direction reversed
		if (pos.dir == '<-') {
			const {
				start,
				end
			} = pos;
			pos.start = end;
			pos.end = start;
		}
		let current = 0;
		visit(arg_el, el => {
			if (el.nodeType !== Node.TEXT_NODE)
				return;
			const len = (el.nodeValue || '').length;
			if (current + len > pos.start) {
				if (!startNode) {
					startNode = el;
					startOffset = pos.start - current;
				}
				if (current + len > pos.end) {
					endNode = el;
					endOffset = pos.end - current;
					return 'stop';
				}
			}
			current += len;
		});
		if (!startNode)
			startNode = arg_el, startOffset = arg_el.childNodes.length;
		if (!endNode)
			endNode = arg_el, endOffset = arg_el.childNodes.length;
		// Flip back the selection
		if (pos.dir == '<-') {
			[startNode, startOffset, endNode, endOffset] = [endNode, endOffset, startNode, startOffset];
		}
		s.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
	}

	function beforeCursor() {
		const s = getSelection();
		const r0 = s.getRangeAt(0);
		const r = document.createRange();
		r.selectNodeContents(arg_el);
		r.setEnd(r0.startContainer, r0.startOffset);
		return r.toString();
	}

	function afterCursor() {
		const s = getSelection();
		const r0 = s.getRangeAt(0);
		const r = document.createRange();
		r.selectNodeContents(arg_el);
		r.setStart(r0.endContainer, r0.endOffset);
		return r.toString();
	}

	function handleNewLine(event) {
		// submit on ctrl enter
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
		{ //https://gist.github.com/KacperKozak/9736160#file-ctrl-enter-js
			weco.submit();
		}
		else if (event.key === 'Enter') {
			const before = beforeCursor();
			const after = afterCursor();
			let [padding] = findPadding(before);
			let newLinePadding = padding;
			// If last symbol is "{" ident new line
			if (options.indentOn.test(before)) {
				newLinePadding += options.tab;
			}
			// Preserve padding
			if (newLinePadding.length > 0) {
				preventDefault(event);
				event.stopPropagation();
				insert('\n' + newLinePadding);
			} else {
				legacyNewLineFix(event);
			}
			// Place adjacent "}" on next line
			if (newLinePadding !== padding && options.moveToNewLine.test(after)) {
				const pos = save();
				insert('\n' + padding);
				restore(pos);
			}
		}
	}

	function legacyNewLineFix(event) {
		// Firefox does not support plaintext-only mode
		// and puts <div><br></div> on Enter. Let's help.
		if (isLegacy && event.key === 'Enter') {
			preventDefault(event);
			event.stopPropagation();
			if (afterCursor() == '') {
				insert('\n ');
				const pos = save();
				pos.start = --pos.end;
				restore(pos);
			} else {
				insert('\n');
			}
		}
	}

	function handleSelfClosingCharacters(event) {
		const open = `([{'"`;
		const close = `)]}'"`;
		const codeAfter = afterCursor();
		const codeBefore = beforeCursor();
		const escapeCharacter = codeBefore.substr(codeBefore.length - 1) === '\\';
		const charAfter = codeAfter.substr(0, 1);
		if (close.includes(event.key) && !escapeCharacter && charAfter === event.key) {
			// We already have closing char next to cursor.
			// Move one char to right.
			const pos = save();
			preventDefault(event);
			pos.start = ++pos.end;
			restore(pos);
		} else if (open.includes(event.key) &&
			!escapeCharacter &&
			(`"'`.includes(event.key) || ['', ' ', '\n'].includes(charAfter))) {
			preventDefault(event);
			const pos = save();
			const wrapText = pos.start == pos.end ? '' : getSelection().toString();
			const text = event.key + wrapText + close[open.indexOf(event.key)];
			insert(text);
			pos.start++;
			pos.end++;
			restore(pos);
		}
	}

	function handleTabCharacters(event) {
		if (event.key === 'Tab') {
			preventDefault(event);
			if (event.shiftKey) {
				const before = beforeCursor();
				let [padding, start, ] = findPadding(before);
				if (padding.length > 0) {
					const pos = save();
					// Remove full length tab or just remaining padding
					const len = Math.min(options.tab.length, padding.length);
					restore({
						start,
						end: start + len
					});
					document.execCommand('delete');
					pos.start -= len;
					pos.end -= len;
					restore(pos);
				}
			} else {
				insert(options.tab);
			}
		}
	}

	function handleUndoRedo(event) {
		if (isUndo(event)) {
			preventDefault(event);
			at--;
			const record = history[at];
			if (record) {
				arg_el.innerHTML = record.html;
				restore(record.pos);
			}
			if (at < 0)
				at = 0;
		}
		if (isRedo(event)) {
			preventDefault(event);
			at++;
			const record = history[at];
			if (record) {
				arg_el.innerHTML = record.html;
				restore(record.pos);
			}
			if (at >= history.length)
				at--;
		}
	}

	function recordHistory() {
		if (!focus)
			return;
		const html = arg_el.innerHTML;
		const pos = save();
		const lastRecord = history[at];
		if (lastRecord) {
			if (lastRecord.html === html &&
				lastRecord.pos.start === pos.start &&
				lastRecord.pos.end === pos.end)
				return;
		}
		at++;
		history[at] = {
			html,
			pos
		};
		history.splice(at + 1);
		const maxHistory = 300;
		if (at > maxHistory) {
			at = maxHistory;
			history.splice(0, 1);
		}
	}

	function handlePaste(event) {
		preventDefault(event);
		const text = (event.originalEvent || event)
			.clipboardData
			.getData('text/plain')
			.replace(/\r/g, '');
		const pos = save();
		insert(text);
		arg_render(arg_el);
		restore({
			start: Math.min(pos.start, pos.end) + text.length,
			end: Math.min(pos.start, pos.end) + text.length,
			dir: '<-',
		});
	}

	function visit(arg_el, visitor) {
		const queue = [];
		if (arg_el.firstChild)
			queue.push(arg_el.firstChild);
		let el = queue.pop();
		while (el) {
			if (visitor(el) === 'stop')
				break;
			if (el.nextSibling)
				queue.push(el.nextSibling);
			if (el.firstChild)
				queue.push(el.firstChild);
			el = queue.pop();
		}
	}

	function isCtrl(event) {
		return event.metaKey || event.ctrlKey;
	}

	function isUndo(event) {
		return isCtrl(event) && !event.shiftKey && getKeyCode(event) === 'Z';
	}

	function isRedo(event) {
		return isCtrl(event) && event.shiftKey && getKeyCode(event) === 'Z';
	}

	function isCopy(event) {
		return isCtrl(event) && getKeyCode(event) === 'C';
	}

	function getKeyCode(event) {
		let key = event.key || event.keyCode || event.which;
		if (!key)
			return undefined;
		return (typeof key === 'string' ? key : String.fromCharCode(key)).toUpperCase();
	}

	function insert(text) {
		text = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
		document.execCommand('insertHTML', false, text);
	}

	function debounce(cb, wait) {
		let timeout = 0;
		return (...args) => {
			clearTimeout(timeout);
			timeout = window.setTimeout(() => cb(...args), wait);
		};
	}

	function findPadding(text) {
		// Find beginning of previous line.
		let i = text.length - 1;
		while (i >= 0 && text[i] !== '\n')
			i--;
		i++;
		// Find padding of the line.
		let j = i;
		while (j < text.length && /[ \t]/.test(text[j]))
			j++;
		return [text.substring(i, j) || '', i, j];
	}

	function toString() {
		return arg_el.textContent || '';
	}

	function preventDefault(event) {
		event.preventDefault();
	}

	function getSelection() {
		var _a;
		if (((_a = arg_el.parentNode) === null || _a === void 0 ? void 0 : _a.nodeType) == Node.DOCUMENT_FRAGMENT_NODE) {
			return arg_el.parentNode.getSelection();
		}
		return window.getSelection();
	}
	return {
		updateOptions(newOptions) {
			Object.assign(options, newOptions);
		},
		updateCode(code) {
			arg_el.textContent = code;
			arg_render(arg_el);
		},
		onUpdate(cb) {
			callback = cb;
		},
		toString,
		save,
		restore,
		recordHistory,
		destroy() {
			for (let [type, fn] of listeners) {
				arg_el.removeEventListener(type, fn);
			}
		},
	};
}
