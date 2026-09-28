'use strict';
'require view';
'require poll';
'require ui';
'require daeui.common as dae';

return view.extend({
	load: function() { return dae.callGetLog(250); },
	refresh: function() {
		var n = Number(document.getElementById('dae-log-limit').value || 250);
		return dae.callGetLog(n).then(function(res) {
			var el = document.getElementById('dae-log-output');
			if (el) el.textContent = (res && res.output) || _('No log entries found.');
		});
	},
	clear: function() {
		if (!window.confirm(_('Clear the configured dae log file?'))) return;
		return dae.callClearLog().then(function(res) {
			dae.notify((res && (res.message || res.error || res.output)) || _('Done.'), res && res.ok ? 'info' : 'error');
			return this.refresh();
		}.bind(this));
	},
	render: function(data) {
		var self = this, paused = false;
		poll.add(function() { return paused ? Promise.resolve() : self.refresh(); }, 5);
		return E([], [
			E('h2', {}, _('DAE Logs')),
			E('div', { 'class': 'cbi-page-actions', 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
				E('select', { 'id': 'dae-log-limit', 'class': 'cbi-input-select', 'change': ui.createHandlerFn(this, this.refresh) }, [50,100,250,500,1000].map(function(n) { return E('option', { 'value': n, 'selected': n === 250 ? '' : null }, String(n)); })),
				E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, this.refresh) }, _('Refresh')),
				E('button', { 'class': 'btn cbi-button', 'click': function(ev) { paused = !paused; ev.target.textContent = paused ? _('Resume') : _('Pause'); } }, _('Pause')),
				E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': ui.createHandlerFn(this, this.clear) }, _('Clear'))
			]),
			E('pre', { 'id': 'dae-log-output', 'style': 'white-space:pre-wrap;max-height:72vh;overflow:auto' }, (data && data.output) || _('No log entries found.'))
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
