'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';
'require daeui.native as native';

function flatten(data) {
	var out = [];
	[ ['tcp', data && data.tcp], ['udp', data && data.udp] ].forEach(function(pair) {
		(pair[1] || []).forEach(function(c) {
			out.push(Object.assign({ _network: pair[0] }, c));
		});
	});
	return out;
}

function target(c) {
	return c.domain || c.dst || c.destination || '-';
}

function processName(c) {
	return c.pname || c.process || c.process_name || '-';
}

function buildGrid(rows) {
	return native.dataGrid(rows, {
		searchPlaceholder: _('Search source, target, outbound or process…'),
		pageSize: 50,
		filters: [
			{ key:'network', title:_('network'), value:function(c){ return c._network || ''; }, options:['tcp','udp'] },
			{ key:'state', title:_('state'), value:function(c){ return native.text(c.state, ''); } },
			{ key:'outbound', title:_('outbound'), value:function(c){ return native.text(c.outbound, ''); } }
		],
		search: function(c) {
			return [
				c.src, target(c), c.outbound, processName(c), c.state, c.id
			].join(' ');
		},
		columns: [
			{ key:'network', title:_('Network'), value:function(c){ return (c._network || '').toUpperCase(); } },
			{ key:'state', title:_('State'), value:function(c){ return native.text(c.state, ''); } },
			{ key:'src', title:_('Source'), value:function(c){ return native.text(c.src, ''); }, render:function(c){ return E('code',{},native.text(c.src)); } },
			{ key:'target', title:_('Target'), value:target, render:function(c){ return E('code',{},native.text(target(c))); } },
			{ key:'outbound', title:_('Outbound'), value:function(c){ return native.text(c.outbound, ''); } },
			{ key:'process', title:_('Process'), value:processName },
			{ key:'up', title:_('Upload'), numeric:true, value:function(c){ return Number(c.upload_bytes_per_second || 0); }, render:function(c){ return native.humanRate(c.upload_bytes_per_second); } },
			{ key:'down', title:_('Download'), numeric:true, value:function(c){ return Number(c.download_bytes_per_second || 0); }, render:function(c){ return native.humanRate(c.download_bytes_per_second); } }
		]
	});
}

function meta(data) {
	data = data || {};
	var totalTcp = data.total_tcp !== undefined ? data.total_tcp : ((data.tcp || []).length);
	var totalUdp = data.total_udp !== undefined ? data.total_udp : ((data.udp || []).length);
	return _('TCP: ') + totalTcp + ' · ' + _('UDP: ') + totalUdp +
		(data.truncated ? ' · ' + _('backend snapshot truncated at requested limit') : '');
}

return view.extend({
	load: function() {
		return native.loadResource('connections', { limit:1000 });
	},

	refresh: function() {
		return dae.callNativeApiGet('connections', { limit:1000 }).then(function(res) {
			var parsed = native.parse(res);
			var info = document.getElementById('native-connections-meta');
			if (!parsed.ok) {
				var box = document.getElementById('native-connections');
				if (box) dom.content(box, native.errorBox(parsed));
				return;
			}
			if (info) info.textContent = meta(parsed.data);
			if (this.grid) this.grid.setRows(flatten(parsed.data));
		}.bind(this));
	},

	render: function(data) {
		var status = data.status || {};
		var available = status.resources && status.resources.connections === true;

		if (!available) {
			return E([], [
				E('h2', {}, _('Native Connections')),
				native.unavailable(status, 'connections')
			]);
		}

		if (!data.resource || !data.resource.ok) {
			return E([], [
				E('h2', {}, _('Native Connections')),
				native.errorBox(data.resource)
			]);
		}

		this.grid = buildGrid(flatten(data.resource.data));
		poll.add(L.bind(this.refresh, this), 3);

		return E([], [
			E('h2', {}, _('Native Connections')),
			E('div', { 'class':'cbi-map-descr' }, _('Read-only connection snapshot. Search, filters, sorting and paging are handled locally within a backend snapshot of up to 1000 connections.')),
			E('div', { 'id':'native-connections-meta', 'class':'cbi-map-descr' }, meta(data.resource.data)),
			E('div', { 'id':'native-connections' }, this.grid.node)
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
