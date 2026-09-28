'use strict';
'require view';
'require ui';
'require daeui.common as dae';
'require daeui.editor as editor';

return view.extend({
	load: function() { return dae.callListConfigFiles(); },

	jumpToRequestedLine: function(path) {
		if (!this.requestedLine || path !== this.requestedPath) return;
		var line = Math.max(0, Number(this.requestedLine || 1) - 1);
		if (this.editor && this.editor.setCursor) {
			this.editor.setCursor({ line: line, ch: 0 });
			if (this.editor.scrollIntoView) this.editor.scrollIntoView({ line: line, ch: 0 }, 120);
			if (this.editor.focus) this.editor.focus();
		} else {
			var ta = document.getElementById('dae-file-editor');
			if (ta) ta.focus();
		}
	},

	loadPath: function(path) {
		this.currentPath = path;
		return dae.callGetConfigFile(path).then(function(res) {
			if (!res || !res.ok) throw new Error((res && res.error) || _('Unable to read configuration file.'));
			this.currentData = res;
			if (this.editor) {
				this.editor.setValue(res.content || '');
				this.editor.clearHistory();
			} else {
				var ta = document.getElementById('dae-file-editor');
				if (ta) ta.value = res.content || '';
			}
			var info = document.getElementById('dae-file-info');
			if (info) info.textContent = path + (res.latest_backup ? ' · ' + _('Latest backup: ') + res.latest_backup : '');
			var select = document.getElementById('dae-file-select');
			if (select && select.value !== path) select.value = path;
			window.setTimeout(function() { this.jumpToRequestedLine(path); }.bind(this), 0);
		}.bind(this)).catch(function(err) {
			dae.notify(err.message || String(err), 'error');
		});
	},

	currentText: function() {
		if (this.editor) return this.editor.getValue();
		var ta = document.getElementById('dae-file-editor');
		return ta ? ta.value : '';
	},

	save: function(apply) {
		if (!this.currentPath) return;
		var text = this.currentText();
		ui.showModal(_('DAE'), [ E('p', { 'class': 'spinning' }, apply ? _('Validating and hot-reloading…') : _('Validating and saving…')) ]);
		return dae.callSaveConfigFile(this.currentPath, text, !!apply).then(function(res) {
			ui.hideModal();
			var msg = (res && (res.message || res.error)) || _('Operation finished.');
			if (res && res.ok) {
				dae.notify(msg, 'info');
				return;
			}
			var diagnostics = dae.diagnosticsNode(res && res.diagnostics);
			if (diagnostics) {
				ui.showModal(_('DAE validation failed'), [
					E('p', {}, msg),
					diagnostics,
					res && res.output ? E('pre', { 'style':'white-space:pre-wrap;max-height:42vh;overflow:auto' }, res.output) : null,
					E('div', { 'class':'right' }, E('button', { 'class':'btn', 'click':ui.hideModal }, _('Close')))
				]);
			} else {
				if (res && res.output) msg += '\n' + res.output;
				dae.notify(msg, 'error');
			}
		});
	},

	createFile: function() {
		var name = window.prompt(_('New file name under config.d/ (for example routing.dae):'), 'rules.dae');
		if (!name) return;
		var template = '# ' + name + '\n\n';
		return dae.callCreateConfigFile(name, template, false).then(function(res) {
			if (!res || !res.ok) {
				dae.notify((res && res.error) || _('Unable to create file.'), 'error');
				return;
			}
			dae.notify(res.message || _('File created.'));
			window.location.reload();
		});
	},

	render: function(data) {
		var files = (data && data.files) || [];
		var params = new URLSearchParams(window.location.search || '');
		this.requestedPath = params.get('path') || '';
		this.requestedLine = Number(params.get('line') || 0);
		var selected = files.filter(function(x) { return this.requestedPath && x.path === this.requestedPath; }.bind(this))[0] ||
			files.filter(function(x) { return x.main; })[0] || files[0] || null;
		this.currentPath = selected ? selected.path : null;

		var selector = E('select', {
			'id': 'dae-file-select',
			'class': 'cbi-input-select',
			'change': function(ev) { this.loadPath(ev.target.value); }.bind(this)
		}, files.map(function(f) {
			return E('option', { 'value': f.path, 'selected': selected && f.path === selected.path ? '' : null },
				(f.main ? '★ ' : '') + f.path + ' (' + f.size + ' B)');
		}));

		var ta = E('textarea', {
			'id': 'dae-file-editor',
			'class': 'cbi-input-textarea',
			'wrap': 'off',
			'spellcheck': 'false',
			'style': 'width:100%;min-height:68vh;font-family:ui-monospace,SFMono-Regular,Consolas,monospace'
		}, '');

		var node = E([], [
			E('h2', {}, _('DAE Configuration Files')),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('All .dae files below the main configuration directory are discovered automatically. Every write validates the complete main configuration so include relationships are checked as one unit.'),
				E('br'), _('Base directory: '), E('code', {}, (data && data.base) || '/etc/dae')
			]),
			E('div', { 'class': 'cbi-page-actions', 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px' }, [
				selector,
				E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, this.createFile) }, _('New config.d file'))
			]),
			E('div', { 'id': 'dae-file-info', 'class': 'cbi-map-descr' }, this.currentPath || _('No .dae files found.')),
			ta,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-save', 'click': ui.createHandlerFn(this, this.save, false) }, _('Save + Validate')), ' ',
				E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': ui.createHandlerFn(this, this.save, true) }, _('Save & Hot Reload'))
			])
		]);

		window.setTimeout(function() {
			editor.attach(ta).then(function(cm) {
				this.editor = cm;
				if (this.currentPath) this.loadPath(this.currentPath);
			}.bind(this)).catch(function(err) {
				dae.notify(_('Code editor failed to initialize: ') + (err.message || err), 'warning');
				if (this.currentPath) this.loadPath(this.currentPath);
			}.bind(this));
		}.bind(this), 0);

		return node;
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
