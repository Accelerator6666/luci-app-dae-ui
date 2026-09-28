'use strict';
'require baseclass';
'require ui';
'require daeui.common as dae';

function existingSections(all, names) {
	var wanted = {};
	names.forEach(function(n) { wanted[n] = true; });
	var items = ((all && all.sections) || []).filter(function(x) { return wanted[x.name]; });
	if (!items.length)
		return E('div', { 'class': 'alert-message notice' }, _('No existing matching sections were found.'));
	return E('div', {}, items.map(function(x) {
		return E('div', { 'class': 'cbi-section' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;gap:12px;align-items:center' }, [
				E('h3', { 'style': 'margin-bottom:4px' }, x.name),
				x.source ? E('a', { 'href':dae.configUrl(x.source, 0) }, E('code', {}, x.source)) : E('code', {}, '-')
			]),
			E('pre', { 'style': 'white-space:pre-wrap;max-height:360px;overflow:auto' }, x.content || '')
		]);
	}));
}

function includeBanner(managed) {
	if (managed && managed.include_enabled)
		return E('div', { 'class': 'alert-message success' }, _('Managed config is enabled through config.d/*.dae.'));
	return E('div', { 'class': 'alert-message warning' }, [
		E('strong', {}, _('Managed writes are disabled. ')),
		_('The main dae configuration does not include config.d/*.dae. Existing configuration is still shown read-only; this UI will not modify the main config automatically.')
	]);
}

function appendLine(id, text) {
	var ta = document.getElementById(id);
	if (!ta) return;
	var old = ta.value || '';
	ta.value = old + (old && !old.endsWith('\n') ? '\n' : '') + text + '\n';
	ta.dispatchEvent(new Event('input'));
}

function preview(kind, id) {
	var ta = document.getElementById(id);
	if (!ta) return Promise.resolve();
	ui.showModal(_('Staged diff'), [ E('p', { 'class': 'spinning' }, _('Preparing diff preview…')) ]);
	return dae.callPreviewManagedSection(kind, ta.value || '').then(function(res) {
		if (!res || !res.ok) {
			ui.hideModal();
			dae.notify((res && res.error) || _('Unable to generate diff.'), 'error');
			return;
		}
		ui.showModal(_('Staged diff: ') + (res.path || kind), [
			E('pre', { 'style': 'white-space:pre-wrap;max-height:70vh;overflow:auto;min-width:60vw' }, res.identical ? _('No differences.') : (res.output || _('No diff output.'))),
			E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close')))
		]);
	});
}

function save(kind, id, apply) {
	var ta = document.getElementById(id);
	if (!ta) return Promise.resolve();
	ui.showModal(_('DAE'), [ E('p', { 'class': 'spinning' }, apply ? _('Validating and hot-reloading staged changes…') : _('Validating staged changes…')) ]);
	return dae.callSaveManagedSection(kind, ta.value || '', !!apply).then(function(res) {
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
}

function editor(kind, managed, help, quick) {
	var id = 'dae-managed-' + kind;
	var body = (managed && managed.body) || '';
	var controls = [];
	if (quick) controls.push(quick(id));
	controls.push(
		E('textarea', {
			'id': id,
			'class': 'cbi-input-textarea',
			'wrap': 'off',
			'spellcheck': 'false',
			'disabled': managed && managed.include_enabled ? null : '',
			'style': 'width:100%;min-height:260px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre'
		}, body),
		E('div', { 'class': 'cbi-page-actions' }, [
			E('button', {
				'class': 'btn cbi-button',
				'disabled': managed && managed.include_enabled ? null : '',
				'click': function() { return preview(kind, id); }
			}, _('Preview diff')), ' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-save',
				'disabled': managed && managed.include_enabled ? null : '',
				'click': function() { return save(kind, id, false); }
			}, _('Save + Validate')), ' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'disabled': managed && managed.include_enabled ? null : '',
				'click': function() { return save(kind, id, true); }
			}, _('Apply staged changes'))
		])
	);
	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, _('DAE UI managed section')),
		E('div', { 'class': 'cbi-map-descr' }, [
			help,
			E('br'),
			_('Managed file: '), E('code', {}, (managed && managed.path) || '-')
		]),
		controls
	]);
}

return baseclass.extend({
	existingSections: existingSections,
	includeBanner: includeBanner,
	appendLine: appendLine,
	preview: preview,
	save: save,
	editor: editor
});
