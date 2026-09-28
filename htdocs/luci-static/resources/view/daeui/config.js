'use strict';
'require view';
'require ui';
'require daeui.common as dae';

return view.extend({
	load: function() { return dae.callGetConfig(); },
	read: function() { return document.getElementById('dae-config-editor').value; },
	save: function(apply) {
		var content = this.read();
		if (!content.trim()) { dae.notify(_('Configuration cannot be empty.'), 'error'); return; }
		ui.showModal(_('DAE'), [ E('p', { 'class': 'spinning' }, apply ? _('Validating and hot-reloading…') : _('Validating and saving…')) ]);
		return (apply ? dae.callApplyConfig(content) : dae.callSaveConfig(content)).then(function(res) {
			ui.hideModal();
			var msg = (res && (res.message || res.error)) || _('Operation finished.');
			if (res && res.output) msg += '\\n' + res.output;
			dae.notify(msg, res && res.ok ? 'info' : 'error');
		});
	},
	restore: function() {
		if (!window.confirm(_('Restore the newest backup and reload dae?'))) return;
		return dae.callRestoreLast().then(function(res) {
			dae.notify(res && res.ok ? _('Backup restored.') : ((res && res.error) || _('Restore failed.')), res && res.ok ? 'info' : 'error');
			if (res && res.ok) window.setTimeout(function() { window.location.reload(); }, 500);
		});
	},
	render: function(data) {
		return E([], [
			E('h2', {}, _('DAE Configuration')),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Edits are validated with dae before they are accepted. Save & Apply creates a timestamped backup, validates, then uses dae hot reload. A failed validation or reload restores the previous configuration.'),
				E('br'), _('Path: '), E('code', {}, data.path || '/etc/dae/config.dae')
			]),
			E('textarea', {
				'id': 'dae-config-editor', 'class': 'cbi-input-textarea', 'wrap': 'off', 'spellcheck': 'false',
				'style': 'width:100%;min-height:68vh;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;tab-size:4'
			}, data.content || ''),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-save', 'click': ui.createHandlerFn(this, this.save, false) }, _('Save + Validate')), ' ',
				E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': ui.createHandlerFn(this, this.save, true) }, _('Save & Hot Reload')), ' ',
				E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': ui.createHandlerFn(this, this.restore) }, _('Restore latest backup'))
			])
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
