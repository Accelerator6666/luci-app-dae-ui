'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';

function quick(id) {
	return E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0' }, [
		E('button', { 'class': 'btn cbi-button', 'click': function() {
			var ta=document.getElementById(id);
			if (!ta || (ta.value||'').trim()) return;
			ta.value="upstream {\n    local_dns: 'udp://223.5.5.5:53'\n    remote_dns: 'https://dns.google/dns-query'\n}\nrouting {\n    request {\n        qname(geosite:cn) -> local_dns\n        fallback: remote_dns\n    }\n}\n";
		} }, _('Insert split-DNS template'))
	]);
}

return view.extend({
	load: function() { return Promise.all([ dae.callGetSections(), dae.callGetManagedSection('dns') ]); },
	render: function(data) {
		return E([], [
			E('h2', {}, _('DNS')),
			E('div', { 'class': 'cbi-map-descr' }, _('DAE DNS syntax is nested and order-sensitive, so v0.3 keeps the managed DNS block text-based while providing a safe template and full validation.')),
			managed.includeBanner(data[1]),
			managed.existingSections(data[0], [ 'dns' ]),
			managed.editor('dns', data[1], _('Edit upstream, request routing and response routing within this managed DNS section.'), quick)
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
