'use strict';
'require baseclass';

function splitComment(line) {
	line = String(line || '');
	var quote = '', escaped = false;
	for (var i = 0; i < line.length; i++) {
		var ch = line.charAt(i);
		if (escaped) { escaped = false; continue; }
		if (quote) {
			if (ch === '\\') escaped = true;
			else if (ch === quote) quote = '';
			continue;
		}
		if (ch === '"' || ch === "'") { quote = ch; continue; }
		if (ch === '#') return { code:line.slice(0, i), comment:line.slice(i), index:i };
	}
	return { code:line, comment:'', index:line.length };
}

function lineRanges(text) {
	text = String(text || '');
	var out = [], start = 0;
	for (var i = 0; i <= text.length; i++) {
		if (i === text.length || text.charAt(i) === '\n') {
			out.push({ start:start, end:i, next:i < text.length ? i + 1 : i, text:text.slice(start, i) });
			start = i + 1;
		}
	}
	return out;
}

function unescapeQuoted(value, quote) {
	value = String(value || '');
	var out = '';
	for (var i = 0; i < value.length; i++) {
		var ch = value.charAt(i);
		if (ch === '\\' && i + 1 < value.length) {
			var next = value.charAt(i + 1);
			if (next === quote || next === '\\') {
				out += next;
				i++;
				continue;
			}
		}
		out += ch;
	}
	return out;
}

function parseTaggedLine(line, lineStart) {
	var part = splitComment(line);
	var code = part.code;
	var m = code.match(/^(\s*)([A-Za-z0-9_.-]+)(\s*:\s*)(['"])/);
	if (!m) return null;
	var quote = m[4];
	var open = m[0].length - 1;
	var escaped = false, close = -1;
	for (var i = open + 1; i < code.length; i++) {
		var ch = code.charAt(i);
		if (escaped) { escaped = false; continue; }
		if (ch === '\\') { escaped = true; continue; }
		if (ch === quote) { close = i; break; }
	}
	if (close < 0 || code.slice(close + 1).trim()) return null;
	return {
		name:m[2],
		quote:quote,
		value:unescapeQuoted(code.slice(open + 1, close), quote),
		rawValue:code.slice(open + 1, close),
		valueStart:lineStart + open + 1,
		valueEnd:lineStart + close,
		lineStart:lineStart,
		lineEnd:lineStart + line.length,
		raw:line
	};
}

function parseTaggedEntries(text) {
	var out = [];
	lineRanges(text).forEach(function(line) {
		var item = parseTaggedLine(line.text, line.start);
		if (item) out.push(item);
	});
	return out;
}

function escapeQuoted(value, quote) {
	return String(value == null ? '' : value)
		.replace(/\\/g, '\\\\')
		.replace(new RegExp('\\' + quote, 'g'), '\\' + quote);
}

function replaceTaggedValue(text, name, value) {
	var matches = parseTaggedEntries(text).filter(function(entry) { return entry.name === name; });
	if (matches.length !== 1) return { ok:false, code:matches.length ? 'duplicate' : 'missing', text:text };
	var entry = matches[0];
	var replacement = escapeQuoted(value, entry.quote);
	return {
		ok:true,
		text:String(text || '').slice(0, entry.valueStart) + replacement + String(text || '').slice(entry.valueEnd),
		entry:entry
	};
}

function matchingBrace(text, open) {
	var depth = 0, quote = '', escaped = false, comment = false;
	for (var i = open; i < text.length; i++) {
		var ch = text.charAt(i);
		if (comment) { if (ch === '\n') comment = false; continue; }
		if (escaped) { escaped = false; continue; }
		if (quote) {
			if (ch === '\\') escaped = true;
			else if (ch === quote) quote = '';
			continue;
		}
		if (ch === '"' || ch === "'") { quote = ch; continue; }
		if (ch === '#') { comment = true; continue; }
		if (ch === '{') depth++;
		else if (ch === '}') {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function braceDelta(line) {
	var part = splitComment(line), code = part.code;
	var quote = '', escaped = false, delta = 0;
	for (var i = 0; i < code.length; i++) {
		var ch = code.charAt(i);
		if (escaped) { escaped = false; continue; }
		if (quote) {
			if (ch === '\\') escaped = true;
			else if (ch === quote) quote = '';
			continue;
		}
		if (ch === '"' || ch === "'") { quote = ch; continue; }
		if (ch === '{') delta++;
		else if (ch === '}') delta--;
	}
	return delta;
}

function parseGroupFields(text, bodyStart, bodyEnd) {
	var body = text.slice(bodyStart, bodyEnd);
	var filters = [], policy = null, depth = 0;
	lineRanges(body).forEach(function(line) {
		var raw = line.text;
		var part = splitComment(raw);
		if (depth === 0) {
			var m = part.code.match(/^(\s*)(filter|policy)(\s*:\s*)(.*?)(\s*)$/);
			if (m) {
				var value = m[4] || '';
				var prefixLen = m[1].length + m[2].length + m[3].length;
				var valueStart = bodyStart + line.start + prefixLen;
				var valueEnd = valueStart + value.length;
				var field = {
					key:m[2], value:value, valueStart:valueStart, valueEnd:valueEnd,
					lineStart:bodyStart + line.start, lineEnd:bodyStart + line.end,
					indent:m[1]
				};
				if (m[2] === 'filter') filters.push(field);
				else if (!policy) policy = field;
			}
		}
		depth += braceDelta(part.code);
	});
	return { filters:filters, policy:policy };
}

function parseGroups(text) {
	text = String(text || '');
	var out = [], lines = lineRanges(text), consumedUntil = -1;
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		if (line.start < consumedUntil) continue;
		var part = splitComment(line.text);
		var m = part.code.match(/^(\s*)([A-Za-z_][A-Za-z0-9_.-]*)\s*\{/);
		if (!m) continue;
		var relOpen = part.code.indexOf('{', m[1].length + m[2].length);
		if (relOpen < 0) continue;
		var open = line.start + relOpen;
		var close = matchingBrace(text, open);
		if (close < 0) continue;
		var fields = parseGroupFields(text, open + 1, close);
		out.push({
			name:m[2], start:line.start, open:open, close:close,
			filters:fields.filters, policy:fields.policy,
			filterValues:fields.filters.map(function(f) { return f.value.trim(); }),
			policyValue:fields.policy ? fields.policy.value.trim() : ''
		});
		consumedUntil = close + 1;
	}
	return out;
}

function replaceRanges(text, replacements) {
	var out = String(text || '');
	replacements.sort(function(a,b) { return b.start - a.start; }).forEach(function(r) {
		out = out.slice(0, r.start) + r.value + out.slice(r.end);
	});
	return out;
}

function replaceGroupFields(text, name, next) {
	var matches = parseGroups(text).filter(function(group) { return group.name === name; });
	if (matches.length !== 1) return { ok:false, code:matches.length ? 'duplicate' : 'missing', text:text };
	var group = matches[0], replacements = [];
	if (next.policy !== undefined) {
		if (!group.policy) return { ok:false, code:'policy-missing', text:text };
		replacements.push({ start:group.policy.valueStart, end:group.policy.valueEnd, value:String(next.policy || '').trim() });
	}
	if (next.filters !== undefined) {
		var filters = next.filters.map(function(v) { return String(v || '').trim(); }).filter(Boolean);
		if (filters.length !== group.filters.length)
			return { ok:false, code:'filter-count', text:text, expected:group.filters.length, actual:filters.length };
		group.filters.forEach(function(field, idx) {
			replacements.push({ start:field.valueStart, end:field.valueEnd, value:filters[idx] });
		});
	}
	return { ok:true, text:replaceRanges(text, replacements), group:group };
}

return baseclass.extend({
	splitComment:splitComment,
	parseTaggedEntries:parseTaggedEntries,
	replaceTaggedValue:replaceTaggedValue,
	parseGroups:parseGroups,
	replaceGroupFields:replaceGroupFields
});
