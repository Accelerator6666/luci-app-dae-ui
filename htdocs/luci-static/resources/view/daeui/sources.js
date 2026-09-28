'use strict';
'require view';
'require daeui.common as dae';

return view.extend({
	load: function() { return Promise.all([ dae.callListConfigFiles(), dae.callIncludeStatus(), dae.callGetSections() ]); },
	render: function(data) {
		var files=(data[0]&&data[0].files)||[];
		var counts={};
		((data[2]&&data[2].sections)||[]).forEach(function(s) {
			if (!counts[s.source]) counts[s.source]={};
			counts[s.source][s.name]=(counts[s.source][s.name]||0)+1;
		});
		return E([], [
			E('h2', {}, _('Configuration Sources')),
			E('div', { 'class': data[1]&&data[1].enabled ? 'alert-message success' : 'alert-message warning' },
				data[1]&&data[1].enabled ? _('The main config includes config.d/*.dae.') : _('config.d/*.dae is not detected in the active include block.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'font-weight:700;margin-bottom:8px' }, _('Entry config')),
				E('code', {}, (data[0]&&data[0].main)||'-')
			]),
			files.map(function(f) {
				var c=counts[f.path]||{};
				var tags=Object.keys(c).map(function(k){ return k+' ×'+c[k]; }).join(' · ');
				return E('div', { 'class': 'cbi-section', 'style': 'margin-left:'+(f.main?'0':'24px') }, [
					E('div', { 'style':'display:flex;justify-content:space-between;gap:12px' }, [
						E('code', {}, (f.main?'★ ':'↳ ')+f.path),
						E('span', {}, String(f.size||0)+' B')
					]),
					E('div', { 'class':'cbi-map-descr' }, tags || _('No recognized top-level DAE sections'))
				]);
			})
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
