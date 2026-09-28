'use strict';
'require view';
'require daeui.common as dae';

function row(k, v) {
	return E('div', { 'class': 'tr' }, [
		E('div', { 'class': 'td left', 'style': 'width:250px;font-weight:600' }, k),
		E('div', { 'class': 'td left' }, v)
	]);
}

function resourceRows(data) {
	var resources = (data && data.resources) || {};
	var labels = [
		[ 'runtime', _('Runtime') ],
		[ 'runtime_memory', _('Runtime memory') ],
		[ 'runtime_outbounds', _('Runtime outbounds / policy') ],
		[ 'nodes', _('Nodes') ],
		[ 'groups', _('Groups') ],
		[ 'probes', _('Node probes / latency') ],
		[ 'connections', _('Connections') ],
		[ 'flows', _('Flows') ],
		[ 'routing_trace', _('Routing trace') ],
		[ 'dns_query', _('DNS query') ],
		[ 'dns_cache', _('DNS cache') ],
		[ 'dns_log', _('DNS log') ]
	];

	return labels.map(function(item) {
		var v = resources[item[0]];
		var state = v === true ? { text: _('Available'), badge: true } :
			v === false ? { text: _('Unavailable'), badge: false } :
			{ text: data.capabilities_status === 401 ? _('Auth required') : _('Unknown'), badge: 'WARN' };
		return row(item[1], dae.badge(state.text, state.badge));
	});
}

return view.extend({
	load: function() {
		return dae.callNativeApiStatus();
	},

	render: function(data) {
		data = data || {};
		var discoveryText = data.discovery_status ? 'HTTP ' + data.discovery_status : _('Not probed');
		var capText = data.capabilities_status ? 'HTTP ' + data.capabilities_status : _('Not probed');

		return E([], [
			E('h2', {}, _('Native API Discovery')),
			E('div', { 'class': 'cbi-map-descr' }, _('The UI performs a local read-only probe of /api and /api/v1/capabilities. It never sends or displays the configured API secret.')),
			E('div', { 'class': data.contract_ready ? 'alert-message success' : 'alert-message warning' }, [
				E('strong', {}, data.contract_ready ? _('Compatible discovery detected. ') : _('Compatible discovery not confirmed. ')),
				data.contract_ready
					? _('api_major=1 or a Bearer authentication challenge matches the Doona-compatible discovery model.')
					: _('The configured listener may be absent, stopped, unreachable, or not implement the shared Native API contract.')
			]),
			E('div', { 'class': 'table' }, [
				row(_('native_api block'), dae.badge(data.detected ? _('Detected') : _('Not detected'), !!data.detected)),
				row(_('Enabled in config'), dae.badge(data.enabled ? _('Yes') : _('No'), !!data.enabled)),
				row(_('Listen'), E('code', {}, data.listen || '-')),
				row(_('Local probe base'), E('code', {}, data.probe_base || '-')),
				row(_('Discovery /api'), discoveryText),
				row(_('Backend name'), data.name || '-'),
				row(_('API major'), data.api_major ? String(data.api_major) : '-'),
				row(_('Base path'), E('code', {}, data.base_path || '-')),
				row(_('Bearer challenge'), dae.badge(data.auth_challenge ? _('Yes') : _('No'), data.auth_challenge ? 'PASS' : 'WARN')),
				row(_('Capabilities endpoint'), capText),
				row(_('Doona-compatible contract'), dae.badge(data.contract_ready ? _('Detected') : _('Not confirmed'), data.contract_ready ? true : 'WARN'))
			]),
			E('h3', {}, _('Reported resources')),
			E('div', { 'class': 'table' }, resourceRows(data)),
			data.capabilities_status === 401
				? E('div', { 'class': 'alert-message notice' }, _('The capabilities endpoint requires authentication. This LuCI UI intentionally does not extract or replay the native_api secret; resource rows remain unknown until a public capability response is available.'))
				: null,
			E('p', {}, _('Detailed Connections, node latency, runtime policy selection, DNS telemetry and routing traces are enabled only when the Native API explicitly reports those resources.'))
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
