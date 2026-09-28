'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';

function quick(id) {
	var name = E('input', { 'class': 'cbi-input-text', 'placeholder': _('group name') });
	var policy = E('select', { 'class': 'cbi-input-select' }, [
		'min', 'min_moving_avg', 'random', 'fixed'
	].map(function(p) { return E('option', { 'value': p }, p); }));
	var filter = E('input', { 'class': 'cbi-input-text', 'placeholder': "subtag('my_sub')", 'style': 'min-width:280px;flex:1' });
	return E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0' }, [
		name, policy, filter,
		E('button', { 'class': 'btn cbi-button', 'click': function() {
			var n=(name.value||'').trim(), f=(filter.value||'').trim();
			if (!n) return;
			var text=n+' {\n';
			if (f) text+='    filter: '+f+'\n';
			text+='    policy: '+policy.value+'\n}';
			managed.appendLine(id,text);
			name.value=''; filter.value='';
		} }, _('Stage policy group'))
	]);
}

return view.extend({
	load: function() { return Promise.all([ dae.callGetSections(), dae.callGetManagedSection('groups') ]); },
	render: function(data) {
		return E([], [
			E('h2', {}, _('Policy Groups')),
			E('div', { 'class': 'cbi-map-descr' }, _('Existing groups are read-only here. New groups are staged in a dedicated managed group section and validated as part of the complete dae configuration.')),
			managed.includeBanner(data[1]),
			managed.existingSections(data[0], [ 'group' ]),
			managed.editor('groups', data[1], _('The quick form creates a simple group. Advanced filters and policies can be edited directly in the staged text before applying.'), quick)
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
