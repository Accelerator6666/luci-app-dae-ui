'use strict';
'require baseclass';
'require ui';
'require daeui.common as dae';
'require daeui.configparse as configparse';

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

function textarea(id) {
	return document.getElementById(id);
}

function replaceTextarea(id, text) {
	var ta = textarea(id);
	if (!ta) return false;
	ta.value = text;
	ta.dispatchEvent(new Event('input'));
	return true;
}

function appendLine(id, text) {
	var ta = textarea(id);
	if (!ta) return;
	var old = ta.value || '';
	ta.value = old + (old && !old.endsWith('\n') ? '\n' : '') + text + '\n';
	ta.dispatchEvent(new Event('input'));
}

function preview(kind, id) {
	var ta = textarea(id);
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

function conflictModal(res, staged) {
	ui.showModal(_('Managed file changed on disk'), [
		E('div', { 'class':'alert-message warning' }, _('The managed file changed after this page was loaded. Your staged changes were not written, so newer on-disk changes cannot be overwritten accidentally.')),
		E('details', { 'open':'' }, [
			E('summary', {}, _('Current on-disk managed body')),
			E('pre', { 'style':'white-space:pre-wrap;max-height:28vh;overflow:auto' }, (res && res.current_body) || '')
		]),
		E('details', {}, [
			E('summary', {}, _('Your staged body')),
			E('pre', { 'style':'white-space:pre-wrap;max-height:28vh;overflow:auto' }, staged || '')
		]),
		E('div', { 'class':'right' }, [
			E('button', {
				'class':'btn cbi-button',
				'click':function() {
					return dae.copyText(staged || '').then(function() {
						dae.notify(_('Copied staged content to clipboard.'), 'info');
					}).catch(function() {
						dae.notify(_('Unable to copy staged content.'), 'error');
					});
				}
			}, _('Copy staged content')), ' ',
			E('button', { 'class':'btn', 'click':ui.hideModal }, _('Close'))
		])
	]);
}

function save(kind, id, apply, state) {
	var ta = textarea(id);
	if (!ta) return Promise.resolve();
	var staged = ta.value || '';
	ui.showModal(_('DAE'), [ E('p', { 'class': 'spinning' }, apply ? _('Validating and hot-reloading staged changes…') : _('Validating staged changes…')) ]);
	return dae.callSaveManagedSection(kind, staged, !!apply, state && state.revision || '').then(function(res) {
		ui.hideModal();
		if (res && res.conflict) {
			conflictModal(res, staged);
			return;
		}
		var msg = (res && (res.message || res.error)) || _('Operation finished.');
		if (res && res.ok) {
			if (state && res.revision) state.revision = res.revision;
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

function taggedFieldEditor(kind, managed, title, valueLabel) {
	var entries = configparse.parseTaggedEntries((managed && managed.body) || '');
	if (!entries.length) return null;
	var id = 'dae-managed-' + kind;
	return E('div', { 'class':'cbi-section','style':'margin:10px 0' }, [
		E('h4', {}, title),
		E('div', { 'class':'cbi-map-descr' }, _('These controls change only the selected quoted value in the staged managed body. Tags, comments, spacing and unrelated entries are preserved.')),
		E('div', { 'class':'table' }, entries.map(function(initial) {
			return E('div', { 'class':'tr' }, [
				E('div', { 'class':'td left','style':'font-weight:600' }, E('code', {}, initial.name)),
				E('div', { 'class':'td right','style':'width:150px' }, E('button', {
					'class':'btn cbi-button',
					'disabled':managed && managed.include_enabled ? null : '',
					'click':function() {
						var ta = textarea(id);
						if (!ta) return;
						var matches = configparse.parseTaggedEntries(ta.value || '').filter(function(e) { return e.name === initial.name; });
						if (matches.length !== 1) {
							dae.notify(_('This managed entry is missing or duplicated. Use the raw managed editor to resolve it.'), 'error');
							return;
						}
						var input = E('input', { 'class':'cbi-input-text','style':'width:100%','value':matches[0].value,'autocomplete':'off','spellcheck':'false' });
						ui.showModal(_('Edit managed field: ') + initial.name, [
							E('label', { 'style':'display:block;font-weight:600;margin-bottom:6px' }, valueLabel),
							input,
							E('div', { 'class':'cbi-map-descr','style':'margin-top:8px' }, _('The change is staged only. Preview diff, validation and optional hot reload still happen through the managed-section controls.')),
							E('div', { 'class':'right' }, [
								E('button', { 'class':'btn','click':ui.hideModal }, _('Cancel')), ' ',
								E('button', { 'class':'btn cbi-button cbi-button-action','click':function() {
									var value = String(input.value || '').trim();
									if (!value) { dae.notify(_('The managed value cannot be empty.'), 'warning'); return; }
									var patched = configparse.replaceTaggedValue(ta.value || '', initial.name, value);
									if (!patched.ok) { dae.notify(_('The managed entry changed while it was being edited. Reopen the editor and try again.'), 'error'); return; }
									replaceTextarea(id, patched.text);
									ui.hideModal();
									dae.notify(_('Field-level change staged; unrelated text was preserved.'), 'info');
								}}, _('Stage field change'))
							])
						]);
					}
				}, _('Edit field')))
			]);
		}))
	]);
}

function groupFieldEditor(managed) {
	var groups = configparse.parseGroups((managed && managed.body) || '');
	if (!groups.length) return null;
	var id = 'dae-managed-groups';
	return E('div', { 'class':'cbi-section','style':'margin:10px 0' }, [
		E('h4', {}, _('Managed group field editor')),
		E('div', { 'class':'cbi-map-descr' }, _('Group filters are treated as opaque DAE/honk expressions. Quoted apostrophes, regex syntax and filter text are preserved instead of being split or normalized.')),
		E('div', { 'class':'table' }, groups.map(function(initial) {
			var safe = !!initial.policy && initial.filters.length > 0;
			return E('div', { 'class':'tr' }, [
				E('div', { 'class':'td left' }, [
					E('code', {}, initial.name),
					E('div', { 'class':'cbi-map-descr' }, _('Policy: ') + (initial.policyValue || '-') + ' · ' + initial.filters.length + ' ' + _('filter(s)'))
				]),
				E('div', { 'class':'td right','style':'width:150px' }, E('button', {
					'class':'btn cbi-button',
					'disabled':managed && managed.include_enabled && safe ? null : '',
					'click':function() {
						var ta = textarea(id);
						if (!ta) return;
						var matches = configparse.parseGroups(ta.value || '').filter(function(g) { return g.name === initial.name; });
						if (matches.length !== 1 || !matches[0].policy || !matches[0].filters.length) {
							dae.notify(_('This group cannot be edited safely with field controls. Use the raw managed editor.'), 'error');
							return;
						}
						var current = matches[0];
						var policy = E('input', { 'class':'cbi-input-text','style':'width:100%','value':current.policyValue,'spellcheck':'false' });
						var filters = E('textarea', { 'class':'cbi-input-textarea','style':'width:100%;min-height:130px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace','spellcheck':'false' }, current.filterValues.join('\n'));
						ui.showModal(_('Edit managed group: ') + initial.name, [
							E('label', { 'style':'display:block;font-weight:600;margin-bottom:6px' }, _('Policy')),
							policy,
							E('label', { 'style':'display:block;font-weight:600;margin:12px 0 6px' }, _('Filters — one existing expression per line')),
							filters,
							E('div', { 'class':'cbi-map-descr' }, _('Field mode intentionally keeps the number of filter lines unchanged. Add or remove filters in the raw editor, then validate normally.')),
							E('div', { 'class':'right' }, [
								E('button', { 'class':'btn','click':ui.hideModal }, _('Cancel')), ' ',
								E('button', { 'class':'btn cbi-button cbi-button-action','click':function() {
									var policyValue = String(policy.value || '').trim();
									var filterValues = String(filters.value || '').split(/\r?\n/).map(function(v) { return v.trim(); }).filter(Boolean);
									if (!policyValue) { dae.notify(_('Policy cannot be empty.'), 'warning'); return; }
									if (filterValues.length !== current.filters.length) { dae.notify(_('Field mode cannot add or remove filter lines; use the raw managed editor for that change.'), 'warning'); return; }
									var patched = configparse.replaceGroupFields(ta.value || '', initial.name, { policy:policyValue, filters:filterValues });
									if (!patched.ok) { dae.notify(_('The group changed while it was being edited. Reopen the editor and try again.'), 'error'); return; }
									replaceTextarea(id, patched.text);
									ui.hideModal();
									dae.notify(_('Group field changes staged; unrelated group text was preserved.'), 'info');
								}}, _('Stage group changes'))
							])
						]);
					}
				}, _('Edit fields')))
			]);
		}))
	]);
}

function editor(kind, managed, help, quick) {
	var id = 'dae-managed-' + kind;
	var body = (managed && managed.body) || '';
	var state = { revision:(managed && managed.revision) || '' };
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
				'click': function() { return save(kind, id, false, state); }
			}, _('Save + Validate')), ' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'disabled': managed && managed.include_enabled ? null : '',
				'click': function() { return save(kind, id, true, state); }
			}, _('Apply staged changes'))
		])
	);
	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, _('DAE UI managed section')),
		E('div', { 'class': 'cbi-map-descr' }, [
			help,
			E('br'),
			_('Managed file: '), E('code', {}, (managed && managed.path) || '-'),
			(managed && managed.revision) ? E('span', {}, [ ' · ', _('Revision guard: '), E('code', {}, managed.revision.slice(0, 12)) ]) : null
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
	editor: editor,
	taggedFieldEditor: taggedFieldEditor,
	groupFieldEditor: groupFieldEditor
});
