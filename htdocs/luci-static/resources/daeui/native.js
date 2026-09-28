'use strict';
'require baseclass';
'require daeui.common as dae';

function parse(res) {
	if (!res) return { ok:false, status:0, error:_('No response from Native API gateway.'), data:null };
	if (!res.ok) {
		var msg = res.auth_required ? _('Authentication required by Native API.') :
			(res.error || (res.status ? _('Native API returned HTTP ') + res.status : _('Native API request failed.')));
		return { ok:false, status:Number(res.status||0), error:msg, data:null };
	}
	try {
		return { ok:true, status:Number(res.status||200), error:'', data:JSON.parse(res.body || '{}') };
	} catch (e) {
		return { ok:false, status:Number(res.status||200), error:_('Native API returned invalid JSON: ') + e.message, data:null };
	}
}

function unavailable(status, key) {
	var v = status && status.resources ? status.resources[key] : null;
	if (v === false)
		return E('div', { 'class':'alert-message warning' }, _('This Native API resource is explicitly unavailable.'));
	if (status && status.capabilities_status === 401)
		return E('div', { 'class':'alert-message notice' }, _('The capabilities endpoint requires authentication. This LuCI UI does not extract or replay the native_api secret.'));
	return E('div', { 'class':'alert-message notice' }, _('This resource has not been reported as available by the Native API.'));
}

function errorBox(result) {
	return E('div', { 'class':'alert-message warning' }, result && result.error ? result.error : _('Native API request failed.'));
}

function humanBytes(value) {
	var n = Number(value || 0);
	if (!Number.isFinite(n)) return '-';
	if (n < 1024) return n.toFixed(0) + ' B';
	if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
	if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MiB';
	return (n / 1024 / 1024 / 1024).toFixed(2) + ' GiB';
}

function humanRate(value) {
	return humanBytes(value) + '/s';
}

function text(value, fallback) {
	if (value === null || value === undefined || value === '') return fallback === undefined ? '-' : fallback;
	if (Array.isArray(value)) return value.join(', ');
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

function time(value) {
	if (!value) return '-';
	var d = new Date(value);
	return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function table(headers, rows) {
	if (!rows.length)
		return E('div', { 'class':'alert-message notice' }, _('No records were returned.'));
	return E('div', { 'style':'overflow:auto' }, E('table', { 'class':'table cbi-section-table' }, [
		E('tr', { 'class':'tr table-titles' }, headers.map(function(h) { return E('th', { 'class':'th' }, h); })),
		rows
	]));
}

function loadResource(key, opts) {
	return dae.callNativeApiStatus().then(function(status) {
		if (!status || !status.resources || status.resources[key] !== true)
			return { status:status || {}, resource:null };
		return dae.callNativeApiGet(key, opts || {}).then(function(res) {
			return { status:status, resource:parse(res) };
		});
	});
}

function dataGrid(rows, opts) {
	rows = rows || [];
	opts = opts || {};

	var state = {
		q: '',
		filters: {},
		sort: opts.defaultSort || '',
		desc: !!opts.defaultDesc,
		page: 0,
		pageSize: Number(opts.pageSize || 50)
	};

	var body = E('div');
	var summary = E('span', { 'class':'cbi-map-descr' });
	var prev = E('button', { 'class':'btn cbi-button' }, _('Previous'));
	var next = E('button', { 'class':'btn cbi-button' }, _('Next'));
	var pageSize = E('select', { 'class':'cbi-input-select' }, [25,50,100,200].map(function(n) {
		return E('option', { 'value':n, 'selected':n === state.pageSize ? '' : null }, String(n));
	}));
	var search = E('input', {
		'class':'cbi-input-text',
		'type':'search',
		'placeholder': opts.searchPlaceholder || _('Search current snapshot…'),
		'style':'min-width:260px;flex:1'
	});

	function searchable(row) {
		if (opts.search) return String(opts.search(row) || '').toLowerCase();
		return opts.columns.map(function(col) {
			return col.value ? text(col.value(row), '') : '';
		}).join(' ').toLowerCase();
	}

	function sortValue(row, key) {
		var col = opts.columns.filter(function(c) { return c.key === key; })[0];
		return col && col.value ? col.value(row) : '';
	}

	function compare(a, b, key) {
		var col = opts.columns.filter(function(c) { return c.key === key; })[0] || {};
		var av = sortValue(a, key), bv = sortValue(b, key);
		if (col.numeric) {
			var an = Number(av || 0), bn = Number(bv || 0);
			return an === bn ? 0 : (an < bn ? -1 : 1);
		}
		return String(av == null ? '' : av).localeCompare(String(bv == null ? '' : bv), undefined, { numeric:true, sensitivity:'base' });
	}

	function filtered() {
		var q = state.q.trim().toLowerCase();
		var out = rows.filter(function(row) {
			if (q && searchable(row).indexOf(q) < 0) return false;
			for (var i = 0; i < (opts.filters || []).length; i++) {
				var f = opts.filters[i];
				var wanted = state.filters[f.key] || '';
				if (!wanted) continue;
				var got = f.value ? String(f.value(row) || '') : '';
				if (got !== wanted) return false;
			}
			return true;
		});

		if (state.sort)
			out.sort(function(a,b) {
				var v = compare(a,b,state.sort);
				return state.desc ? -v : v;
			});

		return out;
	}

	function render() {
		var list = filtered();
		var pages = Math.max(1, Math.ceil(list.length / state.pageSize));
		if (state.page >= pages) state.page = pages - 1;
		if (state.page < 0) state.page = 0;
		var start = state.page * state.pageSize;
		var shown = list.slice(start, start + state.pageSize);

		summary.textContent = list.length
			? _('Showing ') + (start + 1) + '–' + (start + shown.length) + ' / ' + list.length
			: _('0 matching records');
		prev.disabled = state.page <= 0;
		next.disabled = state.page >= pages - 1;

		var head = E('tr', { 'class':'tr table-titles' }, opts.columns.map(function(col) {
			if (col.sortable === false || !col.key)
				return E('th', { 'class':'th' }, col.title);
			var mark = state.sort === col.key ? (state.desc ? ' ▼' : ' ▲') : '';
			return E('th', { 'class':'th' }, E('button', {
				'class':'btn-link',
				'style':'font-weight:600',
				'click':function() {
					if (state.sort === col.key) state.desc = !state.desc;
					else { state.sort = col.key; state.desc = false; }
					state.page = 0;
					render();
				}
			}, col.title + mark));
		}));

		var tableRows = shown.map(function(row) {
			return E('tr', { 'class':'tr' }, opts.columns.map(function(col) {
				var v = col.render ? col.render(row) : text(col.value ? col.value(row) : '', '-');
				return E('td', { 'class':'td' }, v);
			}));
		});

		var node = tableRows.length
			? E('div', { 'style':'overflow:auto' }, E('table', { 'class':'table cbi-section-table' }, [ head, tableRows ]))
			: E('div', { 'class':'alert-message notice' }, _('No records match the current filters.'));

		body.replaceChildren(node);
	}

	search.addEventListener('input', function() {
		state.q = search.value || '';
		state.page = 0;
		render();
	});
	pageSize.addEventListener('change', function() {
		state.pageSize = Number(pageSize.value || 50);
		state.page = 0;
		render();
	});
	prev.addEventListener('click', function() { state.page--; render(); });
	next.addEventListener('click', function() { state.page++; render(); });

	var filterNodes = (opts.filters || []).map(function(f) {
		var values = f.options || Array.from(new Set(rows.map(function(row) {
			return f.value ? String(f.value(row) || '') : '';
		}).filter(Boolean))).sort();
		var select = E('select', { 'class':'cbi-input-select' }, [
			E('option', { 'value':'' }, f.allLabel || (_('All ') + f.title)),
			values.map(function(v) {
				var value = typeof v === 'object' ? v.value : v;
				var label = typeof v === 'object' ? v.label : v;
				return E('option', { 'value':value }, label);
			})
		]);
		select.addEventListener('change', function() {
			state.filters[f.key] = select.value || '';
			state.page = 0;
			render();
		});
		return select;
	});

	var node = E('div', {}, [
		E('div', {
			'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px'
		}, [ search, filterNodes, pageSize, prev, next, summary ]),
		body
	]);

	render();

	return {
		node: node,
		setRows: function(nextRows) {
			rows = nextRows || [];
			state.page = 0;
			render();
		},
		state: state
	};
}

return baseclass.extend({
	parse:parse,
	unavailable:unavailable,
	errorBox:errorBox,
	humanBytes:humanBytes,
	humanRate:humanRate,
	text:text,
	time:time,
	table:table,
	loadResource:loadResource,
	dataGrid:dataGrid
});
