'use strict';
'require view';
'require ui';
'require daeui.common as dae';
'require daeui.native as native';

function parse(res) {
	return native.parse(res);
}

function field(label, node, help) {
	return E('div', { 'class':'cbi-value' }, [
		E('label', { 'class':'cbi-value-title' }, label),
		E('div', { 'class':'cbi-value-field' }, [
			node,
			help ? E('div', { 'class':'cbi-value-description' }, help) : null
		])
	]);
}

function tracePreview(values) {
	var input = {
		network: values.network,
		dst_port: Number(values.dst_port || 443)
	};
	if (values.domain) input.domain = values.domain;
	if (values.dst_ip) input.dst_ip = values.dst_ip;
	if (values.src_ip) input.src_ip = values.src_ip;
	if (values.src_port) input.src_port = Number(values.src_port);
	if (values.pname) input.pname = values.pname;
	return JSON.stringify({ input:input, resolve:values.resolve }, null, 2);
}

function renderTrace(result) {
	if (!result || !result.ok) return native.errorBox(result);
	var data = result.data || {};
	var evalRows = [];
	(data.evaluations || []).forEach(function(ev, ei) {
		evalRows.push(E('tr', { 'class':'tr' }, [
			E('td', { 'class':'td' }, String(ei + 1)),
			E('td', { 'class':'td' }, E('code', {}, native.text(ev.dst_ip))),
			E('td', { 'class':'td' }, native.text(ev.decision)),
			E('td', { 'class':'td' }, E('strong', {}, native.text(ev.outbound))),
			E('td', { 'class':'td' }, native.text(ev.missing_inputs)),
			E('td', { 'class':'td' }, String((ev.rules || []).length))
		]));
	});

	var ruleRows = [];
	(data.evaluations || []).forEach(function(ev, ei) {
		(ev.rules || []).forEach(function(rule) {
			ruleRows.push(E('tr', { 'class':'tr' }, [
				E('td', { 'class':'td' }, String(ei + 1)),
				E('td', { 'class':'td' }, E('code', {}, native.text(rule.rule_id))),
				E('td', { 'class':'td' }, native.text(rule.expression)),
				E('td', { 'class':'td' }, native.text(rule.result)),
				E('td', { 'class':'td' }, native.text(rule.missing_inputs))
			]));
		});
	});

	var dnsRows = (data.dns || []).map(function(d) {
		return E('tr', { 'class':'tr' }, [
			E('td', { 'class':'td' }, native.text(d.name)),
			E('td', { 'class':'td' }, native.text(d.qtype)),
			E('td', { 'class':'td' }, native.text(d.source)),
			E('td', { 'class':'td' }, native.text(d.cache)),
			E('td', { 'class':'td' }, native.text(d.upstream)),
			E('td', { 'class':'td' }, native.text(d.status)),
			E('td', { 'class':'td' }, native.text(d.addresses))
		]);
	});

	return E([], [
		E('div', { 'class':'alert-message success' }, [
			_('Simulation result · generation '), E('code', {}, native.text(data.generation_id)),
			' · ', native.time(data.observed_at)
		]),
		E('h4', {}, _('Evaluations')),
		native.table([ '#', _('Destination IP'), _('Decision'), _('Outbound'), _('Missing inputs'), _('Rules checked') ], evalRows),
		E('h4', {}, _('Rule evaluations')),
		native.table([ _('Evaluation'), _('Rule ID'), _('Expression'), _('Result'), _('Missing inputs') ], ruleRows),
		E('h4', {}, _('Simulation DNS')),
		native.table([ _('Name'), _('Type'), _('Source'), _('Cache'), _('Upstream'), _('Status'), _('Addresses') ], dnsRows),
		E('details', {}, [
			E('summary', {}, _('Raw response')),
			E('pre', { 'style':'white-space:pre-wrap;max-height:420px;overflow:auto' }, JSON.stringify(data, null, 2))
		])
	]);
}

function renderDns(result) {
	if (!result || !result.ok) return native.errorBox(result);
	var data = result.data || {};
	var rows = (data.results || []).map(function(r) {
		var answers = (r.answers || []).map(function(a) { return a.data || ''; }).filter(Boolean).join(', ');
		var route = r.route ? native.text(r.route.source) + (r.route.rule ? ' · ' + r.route.rule : '') : '-';
		return E('tr', { 'class':'tr' }, [
			E('td', { 'class':'td' }, native.text(r.type)),
			E('td', { 'class':'td' }, native.text(r.status)),
			E('td', { 'class':'td' }, r.cached ? _('Yes') : _('No')),
			E('td', { 'class':'td' }, native.text(r.upstream)),
			E('td', { 'class':'td' }, route),
			E('td', { 'class':'td' }, String(r.elapsed_ms || 0) + ' ms'),
			E('td', { 'class':'td' }, E('code', {}, answers || '-'))
		]);
	});

	return E([], [
		E('div', { 'class':'alert-message success' }, [
			E('code', {}, native.text(data.domain)), ' · ',
			_('cache mode: '), native.text(data.cache_mode), ' · ', native.time(data.query_time)
		]),
		native.table([ _('Type'), _('Status'), _('Cached'), _('Upstream'), _('Route'), _('Latency'), _('Answers') ], rows),
		E('details', {}, [
			E('summary', {}, _('Raw response')),
			E('pre', { 'style':'white-space:pre-wrap;max-height:420px;overflow:auto' }, JSON.stringify(data, null, 2))
		])
	]);
}

return view.extend({
	load:function() {
		return dae.callNativeApiStatus();
	},

	traceValues:function() {
		function v(id) { var e=document.getElementById(id); return e ? (e.value || '').trim() : ''; }
		return {
			domain:v('trace-domain'),
			dst_ip:v('trace-dst-ip'),
			network:v('trace-network') || 'tcp',
			dst_port:v('trace-dst-port') || '443',
			src_ip:v('trace-src-ip'),
			src_port:v('trace-src-port'),
			pname:v('trace-pname'),
			resolve:v('trace-resolve') || 'none'
		};
	},

	updateTracePreview:function() {
		var p=document.getElementById('trace-preview');
		if(p) p.textContent=tracePreview(this.traceValues());
	},

	runTrace:function() {
		var v=this.traceValues();
		if(!v.domain && !v.dst_ip) {
			dae.notify(_('Enter a domain or destination IP.'), 'error');
			return;
		}
		var box=document.getElementById('trace-result');
		if(box) box.replaceChildren(E('p',{'class':'spinning'},_('Running bounded routing simulation…')));
		return dae.callNativeRoutingTrace(
			v.domain, v.dst_ip, v.network, Number(v.dst_port || 443),
			v.src_ip, Number(v.src_port || 0), v.pname, v.resolve
		).then(function(res) {
			if(box) box.replaceChildren(renderTrace(parse(res)));
		});
	},

	dnsValues:function() {
		function v(id) { var e=document.getElementById(id); return e ? (e.value || '').trim() : ''; }
		return {
			domain:v('dnsq-domain'),
			types:v('dnsq-types') || 'A,AAAA',
			upstream:v('dnsq-upstream'),
			cache_mode:v('dnsq-cache-mode') || 'normal'
		};
	},

	updateDnsPreview:function() {
		var v=this.dnsValues();
		var parts=['domain='+encodeURIComponent(v.domain)];
		v.types.split(',').map(function(x){return x.trim();}).filter(Boolean).forEach(function(t){parts.push('type='+encodeURIComponent(t));});
		if(v.upstream) parts.push('upstream='+encodeURIComponent(v.upstream));
		parts.push('cache_mode='+encodeURIComponent(v.cache_mode));
		parts.push('detail=full');
		var p=document.getElementById('dnsq-preview');
		if(p) p.textContent='GET /api/v1/dns/query?'+parts.join('&');
	},

	runDns:function() {
		var v=this.dnsValues();
		if(!v.domain) {
			dae.notify(_('Enter a DNS domain.'), 'error');
			return;
		}
		var box=document.getElementById('dnsq-result');
		if(box) box.replaceChildren(E('p',{'class':'spinning'},_('Running diagnostic DNS query…')));
		return dae.callNativeDnsQuery(v.domain,v.types,v.upstream,v.cache_mode).then(function(res) {
			if(box) box.replaceChildren(renderDns(parse(res)));
		});
	},

	render:function(status) {
		status=status||{};
		var canTrace=status.resources&&status.resources.routing_trace===true;
		var canDns=status.resources&&status.resources.dns_query===true;

		var traceInputs=[
			E('input',{'id':'trace-domain','class':'cbi-input-text','placeholder':'example.com'}),
			E('input',{'id':'trace-dst-ip','class':'cbi-input-text','placeholder':'1.1.1.1'}),
			E('select',{'id':'trace-network','class':'cbi-input-select'},[
				E('option',{'value':'tcp'},'TCP'),E('option',{'value':'udp'},'UDP')
			]),
			E('input',{'id':'trace-dst-port','class':'cbi-input-text','type':'number','min':'1','max':'65535','value':'443'}),
			E('input',{'id':'trace-src-ip','class':'cbi-input-text','placeholder':'192.168.1.100'}),
			E('input',{'id':'trace-src-port','class':'cbi-input-text','type':'number','min':'1','max':'65535','placeholder':'optional'}),
			E('input',{'id':'trace-pname','class':'cbi-input-text','placeholder':'optional process name'}),
			E('select',{'id':'trace-resolve','class':'cbi-input-select'},[
				E('option',{'value':'none'},_('Do not resolve domain')),
				E('option',{'value':'live'},_('Allow live DNS for simulation'))
			])
		];

		traceInputs.forEach(function(el){el.addEventListener('input',this.updateTracePreview.bind(this));el.addEventListener('change',this.updateTracePreview.bind(this));}.bind(this));

		var dnsInputs=[
			E('input',{'id':'dnsq-domain','class':'cbi-input-text','placeholder':'example.com'}),
			E('input',{'id':'dnsq-types','class':'cbi-input-text','value':'A,AAAA','placeholder':'A,AAAA'}),
			E('input',{'id':'dnsq-upstream','class':'cbi-input-text','placeholder':_('optional forced upstream')}),
			E('select',{'id':'dnsq-cache-mode','class':'cbi-input-select'},[
				E('option',{'value':'normal'},_('normal')),
				E('option',{'value':'bypass'},_('bypass cache'))
			])
		];

		dnsInputs.forEach(function(el){el.addEventListener('input',this.updateDnsPreview.bind(this));el.addEventListener('change',this.updateDnsPreview.bind(this));}.bind(this));

		var node=E([],[
			E('h2',{},_('Native Diagnostics')),
			E('div',{'class':'cbi-map-descr'},_('These are bounded diagnostic operations from the shared Native API contract. Routing Trace is a hypothetical simulation, not a recorded flow. DNS Query performs a diagnostic resolution and does not flush or delete cache entries.')),

			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Routing Trace')),
				canTrace ? E([],[
					field(_('Domain'),traceInputs[0],_('Domain is optional when destination IP is supplied.')),
					field(_('Destination IP'),traceInputs[1],_('IP is optional when domain is supplied.')),
					field(_('Network'),traceInputs[2]),
					field(_('Destination port'),traceInputs[3]),
					field(_('Source IP'),traceInputs[4]),
					field(_('Source port'),traceInputs[5]),
					field(_('Process name'),traceInputs[6]),
					field(_('Resolve mode'),traceInputs[7]),
					E('h4',{},_('Request preview')),
					E('pre',{'id':'trace-preview','style':'white-space:pre-wrap'},tracePreview({network:'tcp',dst_port:'443',resolve:'none'})),
					E('button',{'class':'btn cbi-button cbi-button-action','click':ui.createHandlerFn(this,this.runTrace)},_('Run routing simulation')),
					E('div',{'id':'trace-result','style':'margin-top:12px'},E('div',{'class':'alert-message notice'},_('No simulation has been run.')))
				]) : native.unavailable(status,'routing_trace')
			]),

			E('div',{'class':'cbi-section'},[
				E('h3',{},_('DNS Query')),
				canDns ? E([],[
					field(_('Domain'),dnsInputs[0]),
					field(_('Record types'),dnsInputs[1],_('Comma-separated, for example A,AAAA,HTTPS.')),
					field(_('Forced upstream'),dnsInputs[2]),
					field(_('Cache mode'),dnsInputs[3]),
					E('h4',{},_('Request preview')),
					E('pre',{'id':'dnsq-preview','style':'white-space:pre-wrap'},'GET /api/v1/dns/query?domain=&type=A&type=AAAA&cache_mode=normal&detail=full'),
					E('button',{'class':'btn cbi-button cbi-button-action','click':ui.createHandlerFn(this,this.runDns)},_('Run DNS diagnostic query')),
					E('div',{'id':'dnsq-result','style':'margin-top:12px'},E('div',{'class':'alert-message notice'},_('No DNS query has been run.')))
				]) : native.unavailable(status,'dns_query')
			])
		]);

		window.setTimeout(function(){this.updateTracePreview();this.updateDnsPreview();}.bind(this),0);
		return node;
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
