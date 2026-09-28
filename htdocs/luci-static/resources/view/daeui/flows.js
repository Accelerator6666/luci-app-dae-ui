'use strict';
'require view';
'require poll';
'require daeui.common as dae';
'require daeui.native as native';

function network(f) {
	return f.network || (f.input && f.input.network) || f.transport || '-';
}

function source(f) {
	return f.src || (f.input && f.input.src) || '-';
}

function target(f) {
	return f.domain || f.dst || f.destination ||
		(f.input && (f.input.domain || f.input.dst || f.input.destination)) || '-';
}

function outbound(f) {
	return f.outbound || f.final_outbound || '-';
}

function buildGrid(rows) {
	return native.dataGrid(rows, {
		searchPlaceholder: _('Search flow, source, target, outbound or connection…'),
		pageSize: 50,
		filters: [
			{ key:'network', title:_('network'), value:network },
			{ key:'state', title:_('state'), value:function(f){ return native.text(f.state || f.status, ''); } },
			{ key:'outbound', title:_('outbound'), value:outbound }
		],
		search: function(f) {
			return [
				f.id, f.connection_id, network(f), source(f), target(f), outbound(f),
				f.state, f.status, f.rule_id, f.rule_expression
			].join(' ');
		},
		columns: [
			{ key:'id', title:_('Flow ID'), value:function(f){ return native.text(f.id, ''); }, render:function(f){ return E('code',{},native.text(f.id)); } },
			{ key:'network', title:_('Network'), value:network },
			{ key:'state', title:_('State'), value:function(f){ return native.text(f.state || f.status, ''); } },
			{ key:'source', title:_('Source'), value:source, render:function(f){ return E('code',{},native.text(source(f))); } },
			{ key:'target', title:_('Target'), value:target, render:function(f){ return E('code',{},native.text(target(f))); } },
			{ key:'outbound', title:_('Outbound'), value:outbound },
			{ key:'connection', title:_('Connection'), value:function(f){ return native.text(f.connection_id, ''); } },
			{ key:'time', title:_('Time'), value:function(f){ return f.started_at || f.observed_at || ''; }, render:function(f){ return native.time(f.started_at || f.observed_at); } }
		]
	});
}

function meta(data, loaded) {
	data = data || {};
	var parts = [ _('Loaded: ') + loaded ];
	if (data.total !== undefined) parts.push(_('Total: ') + data.total);
	if (data.dropped_records !== undefined) parts.push(_('Dropped records: ') + data.dropped_records);
	return parts.join(' · ');
}

return view.extend({
	load:function(){
		return native.loadResource('flows', { limit:200 });
	},

	refresh:function(){
		if (this.loader && this.loader.frozen()) return Promise.resolve();
		return dae.callNativeApiGet('flows', { limit:200 }).then(function(res){
			var parsed=native.parse(res);
			if(parsed.ok && this.loader) this.loader.replaceLive(parsed.data || {});
		}.bind(this));
	},

	render:function(data){
		var status=data.status||{};
		var available=status.resources&&status.resources.flows===true;

		if(!available)
			return E([], [ E('h2',{},_('Native Flows')), native.unavailable(status,'flows') ]);

		if(!data.resource||!data.resource.ok)
			return E([], [ E('h2',{},_('Native Flows')), native.errorBox(data.resource) ]);

		var initial=data.resource.data||{};
		this.grid=buildGrid(initial.flows||[]);
		var info=E('div',{'id':'native-flows-meta','class':'cbi-map-descr'},meta(initial,(initial.flows||[]).length));
		this.loader=native.cursorLoader('flows',initial,{
			grid:this.grid,
			rowsKey:'flows',
			query:{limit:200},
			maxRows:5000,
			onData:function(page,rows){info.textContent=meta(page,rows.length);}
		});

		poll.add(L.bind(this.refresh,this),5);

		return E([],[
			E('h2',{},_('Native Flows')),
			E('div',{'class':'cbi-map-descr'},_('Read-only retained flow summaries. Loading a next_cursor page freezes the current backend snapshot; restart it explicitly to return to live polling.')),
			info,
			this.loader.node,
			this.grid.node
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
