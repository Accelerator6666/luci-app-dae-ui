'use strict';
'require view';
'require ui';
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
		[ 'config', _('Effective config sources') ],
		[ 'nodes', _('Nodes') ],
		[ 'groups', _('Groups') ],
		[ 'probes', _('Node probes / latency') ],
		[ 'operations', _('Operations') ],
		[ 'rules', _('Routing rules') ],
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

	setToken: function() {
		var input = document.getElementById('dae-native-token');
		var token = input ? input.value : '';
		if (!token) {
			dae.notify(_('Enter the Native API Bearer token first.'), 'error');
			return;
		}

		ui.showModal(_('Native API authentication'), [
			E('p', { 'class': 'spinning' }, _('Storing the token in a root-only file and testing capabilities…'))
		]);

		return dae.callSetNativeToken(token).then(function(res) {
			if (input) input.value = '';
			ui.hideModal();

			if (!res || !res.ok) {
				dae.notify((res && res.error) || _('Unable to store Native API token.'), 'error');
				return;
			}

			var msg = res.accepted
				? _('Token stored and authenticated capabilities successfully.')
				: _('Token stored. The capabilities endpoint did not return HTTP 200 yet.');
			dae.notify(msg, res.accepted ? 'info' : 'warning');
			window.setTimeout(function() { window.location.reload(); }, 600);
		});
	},

	clearToken: function() {
		if (!window.confirm(_('Remove the root-only Native API token used by this LuCI package?')))
			return;

		return dae.callClearNativeToken().then(function(res) {
			dae.notify(
				(res && (res.message || res.error)) || _('Native API token removed.'),
				res && res.ok ? 'info' : 'error'
			);
			if (res && res.ok)
				window.setTimeout(function() { window.location.reload(); }, 500);
		});
	},

	render: function(data) {
		data = data || {};
		var discoveryText = data.discovery_status ? 'HTTP ' + data.discovery_status : _('Not probed');
		var capText = data.capabilities_status ? 'HTTP ' + data.capabilities_status : _('Not probed');

		return E([], [
			E('h2', {}, _('Native API Discovery')),
			E('div', { 'class': 'cbi-map-descr' }, _(
				'The rpcd backend probes /api and /api/v1/capabilities locally. It never extracts native_api.secret from dae configuration. An optional token entered below is stored outside UCI in /etc/dae-ui/native-api.token with root-only permissions and is never returned to browser JavaScript.'
			)),

			E('div', { 'class': data.contract_ready ? 'alert-message success' : 'alert-message warning' }, [
				E('strong', {}, data.contract_ready ? _('Compatible discovery detected. ') : _('Compatible discovery not confirmed. ')),
				data.contract_ready
					? _('api_major=1 or a Bearer authentication challenge matches the Doona-compatible discovery model.')
					: _('The configured listener may be absent, stopped, unreachable, unauthenticated, or not implement the shared Native API contract.')
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
				row(_('Stored token'), dae.badge(data.auth_configured ? _('Configured') : _('Not configured'), data.auth_configured ? true : 'WARN')),
				row(_('Token accepted'), data.auth_configured
					? dae.badge(data.auth_accepted ? _('Yes') : _('Not confirmed'), data.auth_accepted ? true : 'WARN')
					: dae.badge(_('Not applicable'), 'WARN')),
				row(_('Capabilities endpoint'), capText),
				row(_('Doona-compatible contract'), dae.badge(data.contract_ready ? _('Detected') : _('Not confirmed'), data.contract_ready ? true : 'WARN'))
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Bearer token')),
				E('div', { 'class': 'cbi-map-descr' }, _(
					'Use this only for Native API token mode. The value is sent once from this LuCI page to rpcd, written with mode 0600, and then used only by server-side curl requests. The field is always blank when this page is reopened.'
				)),
				E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
					E('input', {
						'id': 'dae-native-token',
						'type': 'password',
						'class': 'cbi-input-text',
						'placeholder': _('Native API Bearer token'),
						'autocomplete': 'new-password',
						'style': 'min-width:320px;flex:1'
					}),
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, this.setToken)
					}, data.auth_configured ? _('Replace token') : _('Store token')),
					data.auth_configured ? E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, this.clearToken)
					}, _('Remove token')) : null
				])
			]),

			E('h3', {}, _('Reported resources')),
			E('div', { 'class': 'table' }, resourceRows(data)),

			data.probe_options && data.probe_options.available ? E('div', { 'class':'cbi-section' }, [
				E('h3', {}, _('Probe contract')),
				E('div', { 'class':'table' }, [
					row(_('Targets'), (data.probe_options.targets || []).join(', ') || '-'),
					row(_('Kinds'), (data.probe_options.kinds || []).join(', ') || '-'),
					row(_('Transports'), (data.probe_options.transports || []).join(', ') || '-'),
					row(_('IP versions'), (data.probe_options.ip_versions || []).join(', ') || '-'),
					row(_('Max members / job'), String((data.probe_options.limits || {}).max_members_per_job || '-')),
					row(_('Max results / job'), String((data.probe_options.limits || {}).max_results_per_job || '-')),
					row(_('Job timeout'), (data.probe_options.limits || {}).job_timeout_ms
						? String(data.probe_options.limits.job_timeout_ms) + ' ms' : '-')
				])
			]) : null,

			data.capabilities_status === 401
				? E('div', { 'class': 'alert-message notice' }, data.auth_configured
					? _('The Native API still returns HTTP 401 with the stored token. Check that it matches native_api.secret.')
					: _('The capabilities endpoint requires authentication. Store the Native API token above to enable authenticated read-only runtime resources.'))
				: null,

			E('p', {}, _(
				'Detailed Connections, node latency, routing rules, runtime policy selection, flows and DNS telemetry are enabled only when the Native API explicitly reports those resources.'
			))
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
