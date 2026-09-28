'use strict';
'require view';
'require ui';
'require daeui.common as dae';

return view.extend({
	run: function() {
		var box = document.getElementById('dae-diag');
		box.replaceChildren(E('p', { 'class': 'spinning' }, _('Running diagnostics…')));
		return dae.callDiagnose().then(function(res) {
			var rows = ((res && res.checks) || []).map(function(c) {
				return E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td left', 'style': 'width:120px' }, dae.badge(c.state, c.state)),
					E('div', { 'class': 'td left', 'style': 'width:180px;font-weight:600' }, c.name),
					E('div', { 'class': 'td left' }, E('pre', { 'style': 'white-space:pre-wrap;margin:0' }, c.detail || ''))
				]);
			});
			box.replaceChildren(E('div', { 'class': 'table' }, rows));
			dae.notify(res && res.ok ? _('Core checks passed.') : _('One or more checks need attention.'), res && res.ok ? 'info' : 'warning');
		});
	},
	render: function() {
		return E([], [
			E('h2', {}, _('DAE Diagnostics')),
			E('div', { 'class': 'cbi-map-descr' }, _('Checks process state, configuration validation, eBPF interface presence and default routing.')),
			E('p', {}, E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': ui.createHandlerFn(this, this.run) }, _('Run diagnostics'))),
			E('div', { 'id': 'dae-diag' }, E('div', { 'class': 'alert-message notice' }, _('Run diagnostics to collect current state.')))
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
