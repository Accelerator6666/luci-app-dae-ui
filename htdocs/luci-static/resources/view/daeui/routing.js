'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';

function quick(id) {
	var cond = E('input', { 'class': 'cbi-input-text', 'placeholder': 'domain(geosite:cn)', 'style': 'min-width:300px;flex:1' });
	var out = E('input', { 'class': 'cbi-input-text', 'placeholder': 'direct / proxy / block', 'style': 'min-width:180px' });
	return E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0' }, [
		cond, out,
		E('button', { 'class': 'btn cbi-button', 'click': function() {
			var c=(cond.value||'').trim(), o=(out.value||'').trim();
			if (!c || !o) return;
			managed.appendLine(id,c+' -> '+o);
			cond.value='';
		} }, _('Stage rule'))
	]);
}

return view.extend({
	load: function() { return Promise.all([ dae.callGetSections(), dae.callGetManagedSection('routing') ]); },
	render: function(data) {
		return E([], [
			E('h2', {}, _('Routing')),
			E('div', { 'class': 'cbi-map-descr' }, _('Rules are order-sensitive. Existing routing sections are shown with their source files; staged managed rules are appended only inside the dedicated dae-ui routing section.')),
			managed.includeBanner(data[1]),
			managed.existingSections(data[0], [ 'routing' ]),
			managed.editor('routing', data[1], _('Add rules in normal dae syntax. You can also enter fallback: outbound directly in the staged editor.'), quick)
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
