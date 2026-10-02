'use strict';
'require baseclass';

function protocolOf(url) {
	var m = String(url || '').match(/^([a-zA-Z0-9+.-]+):\/\//);
	return m ? m[1].toUpperCase() : _('Unknown');
}

function redactedLink(url) {
	var raw=String(url||'');
	var m=raw.match(/^([A-Za-z0-9+.-]+):\/\/(.*)$/);
	if(!m) return raw;
	var scheme=m[1].toLowerCase();
	var rest=m[2];
	var at=rest.indexOf('@');
	if(at>=0)
		return scheme+'://••••@'+rest.slice(at+1);

	if(['vmess','ss','ssr'].indexOf(scheme)>=0) {
		var hash=rest.indexOf('#');
		return scheme+'://••••'+(hash>=0?rest.slice(hash):'');
	}
	return raw;
}

function parseEntries(block, kind) {
	var out = [];
	String(block || '').split(/\n/).forEach(function(line) {
		var s = line.replace(/#.*$/, '').trim();
		if (!s) return;
		var m = s.match(/^([A-Za-z0-9_.-]+)\s*:\s*['"]([^'"]+)['"]\s*$/);
		if (m) {
			out.push({ name:m[1], value:m[2], protocol: kind === 'node' ? protocolOf(m[2]) : '' });
			return;
		}
		m = s.match(/^['"]([^'"]+)['"]\s*$/);
		if (m) out.push({ name:'', value:m[1], protocol: kind === 'node' ? protocolOf(m[1]) : '' });
	});
	return out;
}

function nodeCards(sectionContent) {
	var body = String(sectionContent || '').replace(/^\s*node\s*\{/, '').replace(/\}\s*$/, '');
	return parseEntries(body, 'node');
}

function subscriptionCards(sectionContent) {
	var body = String(sectionContent || '').replace(/^\s*subscription\s*\{/, '').replace(/\}\s*$/, '');
	return parseEntries(body, 'subscription');
}

function groupCards(sectionContent) {
	var out = [];
	var text = String(sectionContent || '');
	var re = /(^|\n)\s*([A-Za-z0-9_.-]+)\s*\{([\s\S]*?)\n\s*\}/g;
	var m;
	while ((m = re.exec(text)) !== null) {
		var body = m[3] || '';
		var pm = body.match(/\bpolicy\s*:\s*([^\n#]+)/);
		var fm = body.match(/\bfilter\s*:\s*([^\n#]+)/);
		out.push({ name:m[2], policy:pm ? pm[1].trim() : '-', filter:fm ? fm[1].trim() : '-' });
	}
	return out;
}

function routingRows(sectionContent) {
	var out = [];
	String(sectionContent || '').split(/\n/).forEach(function(line) {
		var raw = line.trim();
		if (!raw || raw.startsWith('#')) return;
		if (raw.indexOf('->') !== -1) {
			var p = raw.split('->');
			out.push({ match:p[0].trim(), outbound:p.slice(1).join('->').trim(), type:'rule' });
		} else if (/^fallback\s*:/.test(raw)) {
			out.push({ match:'fallback', outbound:raw.replace(/^fallback\s*:\s*/, ''), type:'fallback' });
		}
	});
	return out;
}

function dnsUpstreams(sectionContent) {
	var text = String(sectionContent || '');
	var m = text.match(/upstream\s*\{([\s\S]*?)\n\s*\}/);
	if (!m) return [];
	return parseEntries(m[1], 'dns');
}

function card(title, meta, body) {
	return E('div', {
		'class':'cbi-section',
		'style':'display:inline-block;vertical-align:top;min-width:260px;max-width:420px;margin:0 10px 10px 0;padding:12px'
	}, [
		E('div', { 'style':'font-weight:700;font-size:1.05em;margin-bottom:4px;word-break:break-all' }, title || _('Unnamed')),
		meta ? E('div', { 'class':'cbi-map-descr','style':'margin-bottom:8px' }, meta) : null,
		E('div', { 'style':'word-break:break-all' }, body || '')
	]);
}

return baseclass.extend({
	protocolOf:protocolOf,
	redactedLink:redactedLink,
	nodeCards:nodeCards,
	subscriptionCards:subscriptionCards,
	groupCards:groupCards,
	routingRows:routingRows,
	dnsUpstreams:dnsUpstreams,
	card:card
});
