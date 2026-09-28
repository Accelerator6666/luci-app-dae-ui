'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';

function nodeQuick(id) {
	var tag = E('input', { 'class': 'cbi-input-text', 'placeholder': _('optional tag'), 'style': 'min-width:140px' });
	var url = E('input', { 'class': 'cbi-input-text', 'placeholder': 'vless://… / ss://… / socks5://…', 'style': 'min-width:360px;flex:1' });
	return E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0' }, [
		tag, url,
		E('button', { 'class': 'btn cbi-button', 'click': function() {
			var u = (url.value || '').trim();
			if (!u) return;
			var t = (tag.value || '').trim();
			var escaped = u.replace(/'/g, "\\'");
			managed.appendLine(id, (t ? t + ': ' : '') + "'" + escaped + "'");
			url.value = '';
		} }, _('Stage node'))
	]);
}

function subQuick(id) {
	var tag = E('input', { 'class': 'cbi-input-text', 'placeholder': _('subscription tag'), 'style': 'min-width:160px' });
	var url = E('input', { 'class': 'cbi-input-text', 'placeholder': 'https://…', 'style': 'min-width:360px;flex:1' });
	return E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0' }, [
		tag, url,
		E('button', { 'class': 'btn cbi-button', 'click': function() {
			var t = (tag.value || '').trim(), u = (url.value || '').trim();
			if (!t || !u) return;
			managed.appendLine(id, t + ": '" + u.replace(/'/g, "\\'") + "'");
			url.value = '';
		} }, _('Stage subscription'))
	]);
}

return view.extend({
	load: function() {
		return Promise.all([ dae.callGetSections(), dae.callGetManagedSection('nodes'), dae.callGetManagedSection('subscriptions') ]);
	},
	render: function(data) {
		return E([], [
			E('h2', {}, _('Nodes & Subscriptions')),
			E('div', { 'class': 'cbi-map-descr' }, _('Existing definitions remain untouched. New entries staged here are written only to dae-ui managed files under config.d/.')),
			managed.includeBanner(data[1]),
			E('h3', {}, _('Existing node/subscription configuration')),
			managed.existingSections(data[0], [ 'node', 'subscription' ]),
			managed.editor('nodes', data[1], _('Use one DAE node entry per line.'), nodeQuick),
			managed.editor('subscriptions', data[2], _('Use one tagged DAE subscription entry per line.'), subQuick)
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
