'use strict';
'require view';
'require poll';
'require daeui.common as dae';
'require daeui.native as native';

function latency(node, transport) {
	var best = null;
	(node.health || []).forEach(function(h) {
		if (h.transport !== transport || h.latency_ms === null || h.latency_ms === undefined) return;
		var n = Number(h.latency_ms);
		if (Number.isFinite(n) && (best === null || n < best)) best = n;
	});
	return best;
}

function buildGrid(rows) {
	return native.dataGrid(rows, {
		searchPlaceholder: _('Search node, protocol, provider or group…'),
		pageSize: 50,
		filters: [
			{ key:'protocol', title:_('protocol'), value:function(n){ return native.text(n.protocol, ''); } },
			{ key:'provider', title:_('provider'), value:function(n){ return native.text(n.provider_id || n.subscription_tag, ''); } }
		],
		search: function(n) {
			return [
				n.id, n.name, n.protocol, n.provider_id, n.subscription_tag,
				native.text(n.group_ids, '')
			].join(' ');
		},
		columns: [
			{ key:'name', title:_('Node'), value:function(n){ return native.text(n.name || n.id, ''); } },
			{ key:'protocol', title:_('Protocol'), value:function(n){ return native.text(n.protocol, ''); } },
			{ key:'provider', title:_('Provider'), value:function(n){ return native.text(n.provider_id || n.subscription_tag, ''); } },
			{ key:'groups', title:_('Groups'), value:function(n){ return native.text(n.group_ids, ''); } },
			{ key:'tcp', title:_('TCP latency'), numeric:true, value:function(n){ var v=latency(n,'tcp'); return v === null ? 1e15 : v; }, render:function(n){ var v=latency(n,'tcp'); return v === null ? '-' : v.toFixed(0)+' ms'; } },
			{ key:'udp', title:_('UDP latency'), numeric:true, value:function(n){ var v=latency(n,'udp'); return v === null ? 1e15 : v; }, render:function(n){ var v=latency(n,'udp'); return v === null ? '-' : v.toFixed(0)+' ms'; } }
		]
	});
}

function meta(data, loaded) {
	data = data || {};
	var total = data.total !== undefined ? data.total : loaded;
	return _('Loaded: ') + loaded + ' · ' + _('Total: ') + total;
}

return view.extend({
	load:function() {
		return native.loadResource('nodes', { limit:200 });
	},

	refresh:function() {
		if (this.loader && this.loader.frozen()) return Promise.resolve();
		return dae.callNativeApiGet('nodes', { limit:200 }).then(function(res) {
			var parsed = native.parse(res);
			if (!parsed.ok) return;
			if (this.loader) this.loader.replaceLive(parsed.data || {});
		}.bind(this));
	},

	render:function(data) {
		var status = data.status || {};
		var available = status.resources && status.resources.nodes === true;

		if (!available)
			return E([], [ E('h2',{},_('Native Nodes & Latency')), native.unavailable(status,'nodes') ]);

		if (!data.resource || !data.resource.ok)
			return E([], [ E('h2',{},_('Native Nodes & Latency')), native.errorBox(data.resource) ]);

		var initial = data.resource.data || {};
		this.grid = buildGrid(initial.nodes || []);
		var info = E('div', { 'id':'native-nodes-meta', 'class':'cbi-map-descr' }, meta(initial, (initial.nodes || []).length));
		this.loader = native.cursorLoader('nodes', initial, {
			grid:this.grid,
			rowsKey:'nodes',
			query:{ limit:200 },
			maxRows:5000,
			onData:function(page, rows) { info.textContent = meta(page, rows.length); }
		});

		poll.add(L.bind(this.refresh,this),10);

		return E([],[
			E('h2',{},_('Native Nodes & Latency')),
			E('div',{'class':'cbi-map-descr'},_('Read-only node inventory and backend probe observations. The first server page stays live; loading another cursor page freezes that snapshot so sorting and filtering never mix generations.')),
			info,
			this.loader.node,
			this.grid.node
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
