'use strict';
'require view';
'require poll';
'require dom';
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

function meta(data) {
	data = data || {};
	var flows = data.flows || [];
	var parts = [ _('Loaded: ') + flows.length ];
	if (data.total !== undefined) parts.push(_('Total: ') + data.total);
	if (data.dropped_records !== undefined) parts.push(_('Dropped records: ') + data.dropped_records);
	if (data.next_cursor) parts.push(_('more server pages available'));
	return parts.join(' · ');
}

return view.extend({
	load:function(){
		return native.loadResource('flows', { limit:1000 });
	},

	refresh:function(){
		return dae.callNativeApiGet('flows', { limit:1000 }).then(function(res){
			var parsed=native.parse(res);
			var info=document.getElementById('native-flows-meta');
			if(!parsed.ok){
				var box=document.getElementById('native-flows');
				if(box) dom.content(box,native.errorBox(parsed));
				return;
			}
			if(info) info.textContent=meta(parsed.data);
			if(this.grid) this.grid.setRows((parsed.data&&parsed.data.flows)||[]);
		}.bind(this));
	},

	render:function(data){
		var status=data.status||{};
		var available=status.resources&&status.resources.flows===true;

		if(!available)
			return E([], [ E('h2',{},_('Native Flows')), native.unavailable(status,'flows') ]);

		if(!data.resource||!data.resource.ok)
			return E([], [ E('h2',{},_('Native Flows')), native.errorBox(data.resource) ]);

		this.grid=buildGrid((data.resource.data&&data.resource.data.flows)||[]);
		poll.add(L.bind(this.refresh,this),5);

		return E([],[
			E('h2',{},_('Native Flows')),
			E('div',{'class':'cbi-map-descr'},_('Read-only retained flow summaries. Search, filters, sorting and local paging apply to the current server page of up to 1000 flows.')),
			E('div',{'id':'native-flows-meta','class':'cbi-map-descr'},meta(data.resource.data)),
			data.resource.data&&data.resource.data.next_cursor
				? E('div',{'class':'alert-message notice'},_('The backend reports another cursor page. The current page remains stable for local sorting/filtering; no write or trace request is issued.'))
				: null,
			E('div',{'id':'native-flows'},this.grid.node)
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
