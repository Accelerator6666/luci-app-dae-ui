'use strict';
'require view';
'require daeui.common as dae';

return view.extend({
	load: function() { return dae.callNativeApiStatus(); },
	render: function(data) {
		data = data || {};
		return E([], [
			E('h2', {}, _('DAE Native API / Dashboard')),
			E('div', { 'class': data.detected ? 'alert-message notice' : 'alert-message warning' }, [
				E('strong', {}, data.detected ? _('native_api configuration detected. ') : _('native_api is not available in the current dae configuration. ')),
				_('Doona currently targets the shared daeuniverse native API contract implemented by honk. This UI keeps the integration point ready, but does not pretend unsupported dae runtime resources exist.')
			]),
			E('div', { 'class': 'table' }, [
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left', 'style': 'width:220px;font-weight:600' }, _('Detected')), E('div', { 'class': 'td left' }, dae.badge(data.detected ? _('Yes') : _('No'), !!data.detected)) ]),
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left', 'style': 'width:220px;font-weight:600' }, _('Listen')), E('div', { 'class': 'td left' }, data.listen || '-') ]),
				E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left', 'style': 'width:220px;font-weight:600' }, _('Doona-compatible contract')), E('div', { 'class': 'td left' }, dae.badge(_('Not assumed'), 'WARN')) ])
			]),
			E('p', {}, _('Once dae exposes the same native API resources, this page can enable live connections, DNS telemetry, policy selection, routing traces and the Doona-style activity views without changing the rest of the LuCI package.'))
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
