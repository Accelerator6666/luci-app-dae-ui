'use strict';
'require view';
'require ui';
'require daeui.common as dae';

return view.extend({
	load: function() { return dae.callListBackups(); },

	diff: function(path) {
		ui.showModal(_('Configuration diff'), [ E('p', { 'class': 'spinning' }, _('Comparing backup with current file…')) ]);
		return dae.callDiffBackup(path).then(function(res) {
			if (!res || !res.ok) {
				ui.hideModal();
				dae.notify((res && res.error) || _('Diff failed.'), 'error');
				return;
			}
			ui.showModal(_('Diff: ') + path, [
				E('pre', { 'style': 'white-space:pre-wrap;max-height:70vh;overflow:auto;min-width:60vw' }, res.identical ? _('No differences.') : (res.output || _('No diff output.'))),
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close')))
			]);
		});
	},

	restore: function(path, apply) {
		if (!window.confirm(apply ? _('Restore this backup and hot-reload dae?') : _('Restore this backup and validate it without reloading?'))) return;
		return dae.callRestoreBackup(path, !!apply).then(function(res) {
			var msg = (res && (res.message || res.error)) || _('Operation finished.');
			if (res && res.output) msg += '\n' + res.output;
			dae.notify(msg, res && res.ok ? 'info' : 'error');
			if (res && res.ok) window.setTimeout(function() { window.location.reload(); }, 500);
		});
	},

	render: function(data) {
		var list = (data && data.backups) || [];
		return E([], [
			E('h2', {}, _('DAE Backup History')),
			E('div', { 'class': 'cbi-map-descr' }, _('Every file write creates a timestamped sibling backup before the current .dae file is replaced.')),
			list.length ? E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Backup')),
					E('th', { 'class': 'th' }, _('Size')),
					E('th', { 'class': 'th' }, _('Actions'))
				]),
				list.map(function(b) {
					return E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, E('code', {}, b.path)),
						E('td', { 'class': 'td' }, String(b.size || 0) + ' B'),
						E('td', { 'class': 'td' }, [
							E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, this.diff, b.path) }, _('Diff')), ' ',
							E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, this.restore, b.path, false) }, _('Restore + Validate')), ' ',
							E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': ui.createHandlerFn(this, this.restore, b.path, true) }, _('Restore + Reload'))
						])
					]);
				}, this)
			]) : E('div', { 'class': 'alert-message notice' }, _('No backups have been created yet.'))
		]);
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
