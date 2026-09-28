'use strict';
'require view';
'require poll';
'require dom';
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

function meta(data) {
	data = data || {};
	var count = (data.nodes || []).length;
	var total = data.total !== undefined ? data.total : count;
	var parts = [ _('Loaded: ') + count, _('Total: ') + total ];
	if (data.next_cursor) parts.push(_('more server pages available'));
	return parts.join(' · ');
}

return view.extend({
	load:function() {
		return native.loadResource('nodes', { limit:1000 });
	},

	refresh:function() {
		return dae.callNativeApiGet('nodes', { limit:1000 }).then(function(res) {
			var parsed = native.parse(res);
			var info = document.getElementById('native-nodes-meta');
			if (!parsed.ok) {
				var box = document.getElementById('native-nodes');
				if (box) dom.content(box, native.errorBox(parsed));
				return;
			}
			if (info) info.textContent = meta(parsed.data);
			if (this.grid) this.grid.setRows((parsed.data && parsed.data.nodes) || []);
		}.bind(this));
	},

	render:function(data) {
		var status = data.status || {};
		var available = status.resources && status.resources.nodes === true;

		if (!available)
			return E([], [ E('h2',{},_('Native Nodes & Latency')), native.unavailable(status,'nodes') ]);

		if (!data.resource || !data.resource.ok)
			return E([], [ E('h2',{},_('Native Nodes & Latency')), native.errorBox(data.resource) ]);

		this.grid = buildGrid((data.resource.data && data.resource.data.nodes) || []);
		poll.add(L.bind(this.refresh,this),10);

		return E([],[
			E('h2',{},_('Native Nodes & Latency')),
			E('div',{'class':'cbi-map-descr'},_('Read-only node inventory and backend probe observations. Search, filtering, sorting and local paging apply to the current server page of up to 1000 nodes.')),
			E('div',{'id':'native-nodes-meta','class':'cbi-map-descr'},meta(data.resource.data)),
			data.resource.data && data.resource.data.next_cursor
				? E('div',{'class':'alert-message notice'},_('The backend reports another cursor page. v0.7 keeps the first 1000-node page stable for local sorting/filtering; server-side cursor walking is reserved for a later incremental loader.'))
				: null,
			E('div',{'id':'native-nodes'},this.grid.node)
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
