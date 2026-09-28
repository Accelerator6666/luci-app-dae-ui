'use strict';
'require view';
'require daeui.common as dae';
'require daeui.native as native';

function sourceMap(configData) {
	var out = {};
	((configData && configData.sources) || []).forEach(function(s) {
		if (s && s.id) out[s.id] = s;
	});
	return out;
}

function localSet(filesData) {
	var out = {};
	((filesData && filesData.files) || []).forEach(function(f) {
		if (f && f.path) out[f.path] = true;
	});
	return out;
}

function sourceText(rule, sources) {
	var src = rule && rule.source;
	if (!src) return '-';
	var cfg = sources[src.source_id] || {};
	var path = cfg.path || src.file || '';
	var pos = src.line ? ':' + src.line + (src.column ? ':' + src.column : '') : '';
	return (path || src.source_id || '-') + pos;
}

function sourceNode(rule, sources, locals) {
	var src = rule && rule.source;
	if (!src) return '-';

	var cfg = sources[src.source_id] || null;
	var path = cfg && cfg.path ? cfg.path : '';
	var label = sourceText(rule, sources);

	if (path && locals[path])
		return E('a', { 'href':dae.configUrl(path, src.line || 0) }, E('code', {}, label));

	return E('span', {}, [
		E('code', {}, label),
		E('span', { 'class':'cbi-map-descr' }, cfg ? ' · ' + _('not a locally discovered source') : ' · ' + _('source_id not mapped by Native config'))
	]);
}

function buildRows(data) {
	var rules = (data && data.rules) || [];
	return rules.slice();
}

function buildGrid(rows, sources, locals) {
	return native.dataGrid(rows, {
		searchPlaceholder: _('Search expression, outbound, rule ID or source…'),
		pageSize: 50,
		defaultSort: 'index',
		filters: [
			{ key:'kind', title:_('kind'), value:function(r){ return native.text(r.kind, ''); } },
			{ key:'outbound', title:_('outbound'), value:function(r){ return native.text(r.outbound, ''); } }
		],
		search:function(r) {
			return [
				r.rule_id, r.expression, r.outbound, r.kind, sourceText(r, sources)
			].join(' ');
		},
		columns: [
			{ key:'index', title:_('Index'), numeric:true, value:function(r){ return Number(r.index || 0); } },
			{ key:'kind', title:_('Kind'), value:function(r){ return native.text(r.kind, ''); } },
			{ key:'expression', title:_('Expression'), value:function(r){ return native.text(r.expression, ''); }, render:function(r){ return E('code', {}, native.text(r.expression)); } },
			{ key:'outbound', title:_('Outbound'), value:function(r){ return native.text(r.outbound, ''); } },
			{ key:'must', title:_('Must'), value:function(r){ return r.must ? 'yes' : 'no'; }, render:function(r){ return r.must ? _('Yes') : _('No'); } },
			{ key:'rule_id', title:_('Rule ID'), value:function(r){ return native.text(r.rule_id, ''); }, render:function(r){ return E('code', {}, native.text(r.rule_id)); } },
			{ key:'source', title:_('Source'), value:function(r){ return sourceText(r, sources); }, render:function(r){ return sourceNode(r, sources, locals); } }
		]
	});
}

return view.extend({
	load:function() {
		return dae.callNativeApiStatus().then(function(status) {
			if (!status.resources || status.resources.rules !== true)
				return { status:status, rules:null, config:null, files:null };

			return Promise.all([
				dae.callNativeApiGet('rules').then(native.parse),
				status.resources.config === true ? dae.callNativeApiGet('config').then(native.parse) : Promise.resolve(null),
				dae.callListConfigFiles()
			]).then(function(v) {
				return { status:status, rules:v[0], config:v[1], files:v[2] };
			});
		});
	},

	render:function(data) {
		var status=data.status||{};
		if (!(status.resources && status.resources.rules === true))
			return E([], [ E('h2',{},_('Native Rule Dictionary')), native.unavailable(status,'rules') ]);

		if (!data.rules || !data.rules.ok)
			return E([], [ E('h2',{},_('Native Rule Dictionary')), native.errorBox(data.rules) ]);

		var rulesData=data.rules.data||{};
		var configData=data.config&&data.config.ok ? data.config.data : {};
		var sources=sourceMap(configData);
		var locals=localSet(data.files||{});
		var rows=buildRows(rulesData);
		var grid=buildGrid(rows,sources,locals);

		var fallback=rulesData.fallback||null;
		var fallbackNode=fallback ? E('div',{'class':'cbi-section'},[
			E('h3',{},_('Fallback')),
			E('div',{'class':'table'},[
				E('div',{'class':'tr'},[
					E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Outbound')),
					E('div',{'class':'td left'},native.text(fallback.outbound))
				]),
				E('div',{'class':'tr'},[
					E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Source')),
					E('div',{'class':'td left'},sourceNode(fallback,sources,locals))
				])
			])
		]) : null;

		return E([],[
			E('h2',{},_('Native Rule Dictionary')),
			E('div',{'class':'cbi-map-descr'},[
				_('Read-only routing dictionary for one running generation. Rules are joined by generation_id + rule_id. Source navigation uses source_id from Native API config and only becomes clickable when that source path exactly matches a locally discovered .dae file.'),
			]),
			E('div',{'class':'alert-message notice'},[
				_('Generation: '), E('code',{},native.text(rulesData.generation_id)),
				' · ', _('Rules: '), String(rows.length)
			]),
			fallbackNode,
			grid.node
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
