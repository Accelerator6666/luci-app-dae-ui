'use strict';
'require baseclass';

var SECTION_ITEMS = [
	{ label: 'global', insert: 'global {\n    |\n}', detail: 'Global daemon settings' },
	{ label: 'subscription', insert: 'subscription {\n    |\n}', detail: 'Subscription definitions' },
	{ label: 'node', insert: 'node {\n    |\n}', detail: 'Node definitions' },
	{ label: 'group', insert: 'group {\n    |\n}', detail: 'Proxy groups and policies' },
	{ label: 'dns', insert: 'dns {\n    |\n}', detail: 'DNS upstreams and DNS routing' },
	{ label: 'routing', insert: 'routing {\n    |\n}', detail: 'Traffic routing rules' }
];

var GLOBAL_ITEMS = [
	{ label: 'tproxy_port', insert: 'tproxy_port: 12345', detail: 'Transparent proxy port' },
	{ label: 'tproxy_port_protect', insert: 'tproxy_port_protect: true', detail: 'Protect the TProxy port' },
	{ label: 'pprof_port', insert: 'pprof_port: 0', detail: 'pprof debugging port' },
	{ label: 'so_mark_from_dae', insert: 'so_mark_from_dae: 0', detail: 'SO_MARK applied to dae-originated traffic' },
	{ label: 'log_level', insert: 'log_level: info', detail: 'error / warn / info / debug / trace' },
	{ label: 'lan_interface', insert: 'lan_interface: br-lan', detail: 'LAN interface(s) to bind' },
	{ label: 'wan_interface', insert: 'wan_interface: auto', detail: 'WAN interface(s), or auto' },
	{ label: 'auto_config_kernel_parameter', insert: 'auto_config_kernel_parameter: true', detail: 'Configure required kernel parameters automatically' },
	{ label: 'auto_config_firewall_rule', insert: 'auto_config_firewall_rule: true', detail: 'Configure firewall rules automatically' },
	{ label: 'tcp_check_url', insert: "tcp_check_url: 'http://cp.cloudflare.com,1.1.1.1,2606:4700:4700::1111'", detail: 'TCP health-check URL and optional address hints' },
	{ label: 'tcp_check_http_method', insert: 'tcp_check_http_method: HEAD', detail: 'HEAD or GET' },
	{ label: 'udp_check_dns', insert: "udp_check_dns: 'dns.google:53,8.8.8.8,2001:4860:4860::8888'", detail: 'UDP health-check DNS target' },
	{ label: 'check_interval', insert: 'check_interval: 30s', detail: 'Health-check interval' },
	{ label: 'check_tolerance', insert: 'check_tolerance: 50ms', detail: 'Latency switch tolerance' },
	{ label: 'dial_mode', insert: 'dial_mode: domain++', detail: 'ip / domain / domain+ / domain++' },
	{ label: 'allow_insecure', insert: 'allow_insecure: false', detail: 'Allow insecure TLS certificates' },
	{ label: 'sniffing_timeout', insert: 'sniffing_timeout: 100ms', detail: 'Sniffing timeout' },
	{ label: 'tls_implementation', insert: 'tls_implementation: tls', detail: 'tls or utls' },
	{ label: 'utls_imitate', insert: 'utls_imitate: chrome_auto', detail: 'uTLS ClientHello profile' },
	{ label: 'mptcp', insert: 'mptcp: false', detail: 'Multipath TCP support' },
	{ label: 'fallback_resolver', insert: "fallback_resolver: '8.8.8.8:53'", detail: 'Fallback DNS resolver' }
];

var ROUTING_ITEMS = [
	{ label: 'domain', insert: 'domain(|)', detail: 'Match destination domain' },
	{ label: 'dip', insert: 'dip(|)', detail: 'Match destination IP or geoip' },
	{ label: 'dport', insert: 'dport(|)', detail: 'Match destination port or range' },
	{ label: 'sip', insert: 'sip(|)', detail: 'Match source IP' },
	{ label: 'sport', insert: 'sport(|)', detail: 'Match source port' },
	{ label: 'ipversion', insert: 'ipversion(|)', detail: 'Match IP version 4 or 6' },
	{ label: 'l4proto', insert: 'l4proto(|)', detail: 'Match tcp or udp' },
	{ label: 'mac', insert: 'mac(|)', detail: 'Match LAN client MAC address' },
	{ label: 'pname', insert: 'pname(|)', detail: 'Match process name when available' },
	{ label: 'rule-domain', insert: 'domain(|) -> proxy', detail: 'Domain routing rule' },
	{ label: 'rule-geosite', insert: 'domain(geosite:|) -> proxy', detail: 'Geosite routing rule' },
	{ label: 'rule-ip', insert: 'dip(|) -> proxy', detail: 'Destination IP routing rule' },
	{ label: 'rule-geoip', insert: 'dip(geoip:|) -> direct', detail: 'GeoIP routing rule' },
	{ label: 'rule-port', insert: 'dport(|) -> proxy', detail: 'Destination-port routing rule' },
	{ label: 'rule-process', insert: 'pname(|) -> proxy', detail: 'Process-name routing rule' }
];

var DNS_ITEMS = [
	{ label: 'ipversion_prefer', insert: 'ipversion_prefer: 4', detail: 'Prefer IPv4 or IPv6 DNS answers' },
	{ label: 'fixed_domain_ttl', insert: 'fixed_domain_ttl: 300', detail: 'Fixed domain TTL' },
	{ label: 'bind', insert: "bind: '127.0.0.1:5353'", detail: 'DNS listener address' },
	{ label: 'upstream', insert: 'upstream {\n    |\n}', detail: 'DNS upstream definitions' },
	{ label: 'routing', insert: 'routing {\n    request {\n        |\n    }\n}', detail: 'DNS routing block' },
	{ label: 'request', insert: 'request {\n    |\n}', detail: 'DNS request routing rules' },
	{ label: 'response', insert: 'response {\n    |\n}', detail: 'DNS response routing rules' },
	{ label: 'qname', insert: 'qname(|)', detail: 'Match DNS query name' },
	{ label: 'qtype', insert: 'qtype(|)', detail: 'Match DNS query type' },
	{ label: 'upstream()', insert: 'upstream(|)', detail: 'Match DNS upstream in response routing' },
	{ label: 'ip()', insert: 'ip(|)', detail: 'Match response IP' }
];

var GROUP_ITEMS = [
	{ label: 'filter-name', insert: "filter: name(|)", detail: 'Select nodes by name' },
	{ label: 'filter-subtag', insert: "filter: subtag(|)", detail: 'Select nodes by subscription tag' },
	{ label: 'policy-min', insert: 'policy: min', detail: 'Select the lowest last latency' },
	{ label: 'policy-fixed', insert: 'policy: fixed(|)', detail: 'Always select one filtered node by index' },
	{ label: 'policy-random', insert: 'policy: random', detail: 'Random node selection' },
	{ label: 'policy-min-moving-avg', insert: 'policy: min_moving_avg', detail: 'Minimum moving-average latency' },
	{ label: 'policy-min-avg10', insert: 'policy: min_avg10', detail: 'Minimum average of the last ten checks' },
	{ label: 'tcp_check_url', insert: "tcp_check_url: 'http://1.1.1.1'", detail: 'Override TCP health check for this group' },
	{ label: 'udp_check_dns', insert: "udp_check_dns: '8.8.8.8:53'", detail: 'Override UDP health check for this group' },
	{ label: 'check_interval', insert: 'check_interval: 10s', detail: 'Override health-check interval' },
	{ label: 'check_tolerance', insert: 'check_tolerance: 50ms', detail: 'Override latency switch tolerance' }
];

var OUTBOUND_ITEMS = [
	{ label: 'direct', insert: 'direct', detail: 'Connect directly' },
	{ label: 'proxy', insert: 'proxy', detail: 'Use the default proxy group' },
	{ label: 'block', insert: 'block', detail: 'Block the connection' },
	{ label: 'must_direct', insert: 'must_direct', detail: 'Force direct routing' },
	{ label: 'must_proxy', insert: 'must_proxy', detail: 'Force proxy routing' },
	{ label: 'accept', insert: 'accept', detail: 'Accept DNS response' },
	{ label: 'reject', insert: 'reject', detail: 'Reject DNS request/response' },
	{ label: 'asis', insert: 'asis', detail: 'Leave DNS request unchanged' },
	{ label: 'requery', insert: 'requery', detail: 'Requery DNS using another upstream' }
];

function stripComment(line) {
	var quoted = '';
	var out = '';
	for (var i = 0; i < line.length; i++) {
		var ch = line.charAt(i);
		if (quoted) {
			out += ch;
			if (ch === '\\') {
				if (i + 1 < line.length) out += line.charAt(++i);
				continue;
			}
			if (ch === quoted) quoted = '';
			continue;
		}
		if (ch === '"' || ch === "'") {
			quoted = ch;
			out += ch;
			continue;
		}
		if (ch === '#') break;
		out += ch;
	}
	return out;
}

function sectionAt(cm, cursor) {
	var stack = [];
	var sections = { global:1, subscription:1, node:1, group:1, dns:1, routing:1 };
	for (var i = 0; i <= cursor.line; i++) {
		var line = stripComment(cm.getLine(i) || '');
		if (i === cursor.line) line = line.slice(0, cursor.ch);
		var re = /([A-Za-z_][A-Za-z0-9_-]*)\s*\{|[{}]/g;
		var m;
		while ((m = re.exec(line))) {
			if (m[0] === '}') {
				stack.pop();
			} else if (m[0] === '{') {
				stack.push('');
			} else {
				stack.push(m[1]);
			}
		}
	}
	for (var j = 0; j < stack.length; j++)
		if (sections[stack[j]]) return stack[j];
	return '';
}

function groupNames(cm) {
	var lines = cm.getValue().split(/\r?\n/);
	var names = [];
	var inGroup = false;
	var depth = 0;
	for (var i = 0; i < lines.length; i++) {
		var line = stripComment(lines[i]);
		if (!inGroup && /^\s*group\s*\{/.test(line)) {
			inGroup = true;
			depth = 1;
			continue;
		}
		if (!inGroup) continue;
		if (depth === 1) {
			var m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*\{/);
			if (m && names.indexOf(m[1]) < 0) names.push(m[1]);
		}
		var opens = (line.match(/\{/g) || []).length;
		var closes = (line.match(/\}/g) || []).length;
		depth += opens - closes;
		if (depth <= 0) {
			inGroup = false;
			depth = 0;
		}
	}
	return names;
}

function prefixRange(cm) {
	var cursor = cm.getCursor();
	var line = cm.getLine(cursor.line) || '';
	var left = line.slice(0, cursor.ch);
	var m = left.match(/([A-Za-z_][A-Za-z0-9_-]*)$/);
	var prefix = m ? m[1] : '';
	return {
		cursor: cursor,
		prefix: prefix,
		from: { line: cursor.line, ch: cursor.ch - prefix.length },
		to: cursor,
		left: left
	};
}

function uniqueItems(items) {
	var seen = {};
	return items.filter(function(item) {
		if (!item || !item.label || seen[item.label]) return false;
		seen[item.label] = true;
		return true;
	});
}

function candidates(cm, range) {
	var section = sectionAt(cm, range.cursor);
	var all = [];
	var arrow = /(?:->|fallback\s*:)\s*[A-Za-z0-9_-]*$/.test(range.left);
	if (arrow) {
		all = OUTBOUND_ITEMS.concat(groupNames(cm).map(function(name) {
			return { label:name, insert:name, detail:'Configured proxy group' };
		}));
	} else if (section === 'global') {
		all = GLOBAL_ITEMS;
	} else if (section === 'group') {
		all = GROUP_ITEMS;
	} else if (section === 'dns') {
		all = DNS_ITEMS.concat(ROUTING_ITEMS);
	} else if (section === 'routing') {
		all = ROUTING_ITEMS.concat(OUTBOUND_ITEMS);
	} else if (!section) {
		all = SECTION_ITEMS;
	} else {
		all = ROUTING_ITEMS.concat(GLOBAL_ITEMS);
	}

	var q = (range.prefix || '').toLowerCase();
	var filtered = uniqueItems(all).filter(function(item) {
		if (!q) return true;
		return item.label.toLowerCase().indexOf(q) === 0 ||
			String(item.detail || '').toLowerCase().indexOf(q) >= 0;
	});
	return filtered.slice(0, 18);
}

function cursorAfter(from, text) {
	var lines = text.split('\n');
	if (lines.length === 1)
		return { line:from.line, ch:from.ch + text.length };
	return { line:from.line + lines.length - 1, ch:lines[lines.length - 1].length };
}

function insertItem(cm, range, item) {
	var raw = item.insert || item.label;
	var marker = raw.indexOf('|');
	var text = marker >= 0 ? raw.slice(0, marker) + raw.slice(marker + 1) : raw;
	cm.replaceRange(text, range.from, range.to, 'dae-completion');
	if (marker >= 0) {
		var before = raw.slice(0, marker);
		cm.setCursor(cursorAfter(range.from, before));
	} else {
		cm.setCursor(cursorAfter(range.from, text));
	}
	cm.focus();
}

function close(cm) {
	var state = cm._daeCompletionPopup;
	if (!state) return;
	if (state.keyMap) cm.removeKeyMap(state.keyMap);
	if (state.node && state.node.parentNode) state.node.parentNode.removeChild(state.node);
	cm._daeCompletionPopup = null;
}

function show(cm) {
	close(cm);
	var range = prefixRange(cm);
	var items = candidates(cm, range);
	if (!items.length) return;

	var coords = cm.cursorCoords(range.cursor, 'page');
	var node = document.createElement('div');
	node.className = 'dae-completion-popup';
	node.style.left = Math.max(8, coords.left) + 'px';
	node.style.top = (coords.bottom + 4) + 'px';

	var selected = 0;
	var rows = [];

	function refresh() {
		rows.forEach(function(row, idx) {
			row.className = 'dae-completion-row' + (idx === selected ? ' selected' : '');
		});
		if (rows[selected] && rows[selected].scrollIntoView)
			rows[selected].scrollIntoView({ block:'nearest' });
	}

	function choose(idx) {
		if (idx < 0 || idx >= items.length) return;
		var item = items[idx];
		close(cm);
		insertItem(cm, range, item);
	}

	items.forEach(function(item, idx) {
		var row = document.createElement('button');
		row.type = 'button';
		row.className = 'dae-completion-row';
		row.title = item.detail || '';
		var name = document.createElement('span');
		name.className = 'dae-completion-label';
		name.textContent = item.label;
		var detail = document.createElement('span');
		detail.className = 'dae-completion-detail';
		detail.textContent = item.detail || '';
		row.appendChild(name);
		row.appendChild(detail);
		row.addEventListener('mousedown', function(ev) {
			ev.preventDefault();
			choose(idx);
		});
		node.appendChild(row);
		rows.push(row);
	});

	document.body.appendChild(node);
	var keyMap = {
		'Up': function() { selected = (selected + items.length - 1) % items.length; refresh(); },
		'Down': function() { selected = (selected + 1) % items.length; refresh(); },
		'Enter': function() { choose(selected); },
		'Tab': function() { choose(selected); },
		'Esc': function() { close(cm); }
	};
	cm.addKeyMap(keyMap);
	cm._daeCompletionPopup = { node:node, keyMap:keyMap };
	refresh();
}

function attach(cm) {
	if (!cm || cm._daeCompletionAttached) return cm;
	cm._daeCompletionAttached = true;
	cm.addKeyMap({
		'Ctrl-Space': show,
		'Cmd-Space': show
	});
	cm.on('blur', function() {
		window.setTimeout(function() { close(cm); }, 120);
	});
	cm.on('scroll', function() { close(cm); });
	return cm;
}

return baseclass.extend({
	attach: attach,
	show: show,
	close: close
});
