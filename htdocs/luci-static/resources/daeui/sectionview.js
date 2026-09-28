'use strict';
'require baseclass';
'require daeui.common as dae';

function renderType(title, type, description) {
	return {
		load: function() { return dae.callGetSections(); },
		render: function(data) {
			var items = ((data && data.sections) || []).filter(function(x) { return x.name === type; });
			return E([], [
				E('h2', {}, title),
				E('div', { 'class': 'cbi-map-descr' }, description),
				items.length ? items.map(function(x) {
					return E('div', { 'class': 'cbi-section' }, [
						E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;gap:12px' }, [
							E('h3', { 'style': 'margin-bottom:4px' }, type),
							E('code', {}, x.source || '-')
						]),
						E('pre', { 'style': 'white-space:pre-wrap;overflow:auto;max-height:460px' }, x.content || '')
					]);
				}) : E('div', { 'class': 'alert-message notice' }, _('No matching section was found in the active .dae files.')),
				E('p', {}, _('Use Configuration Files to edit the source file. Changes there are validated against the main dae configuration before they can be applied.'))
			]);
		},
		handleSaveApply: null,
		handleSave: null,
		handleReset: null
	};
}

return baseclass.extend({ renderType: renderType });
