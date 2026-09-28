'use strict';
'require view';
'require daeui.common as dae';

return view.extend({
	load: function() { return dae.callGetSections(); },
	render: function(data) {
		var sections = (data && data.sections) || [];
		var order = ['global','subscription','node','group','routing','dns','experimental'];
		return E([], [
			E('h2', {}, _('DAE Config Sections')),
			E('div', { 'class': 'cbi-map-descr' }, _('Read-only structural view inspired by Doona. Editing remains centralized in Configuration so validation and rollback stay atomic.')),
			order.map(function(name) {
				var items = sections.filter(function(x) { return x.name === name; });
				if (!items.length) return null;
				return E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, name),
					items.map(function(x) {
						return E('div', {}, [
							E('div', { 'class':'cbi-map-descr' }, x.source
								? E('a', { 'href':dae.configUrl(x.source, 0) }, E('code', {}, x.source))
								: '-'),
							E('pre', { 'style':'white-space:pre-wrap;overflow:auto;max-height:380px' }, x.content)
						]);
					})
				]);
			})
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
