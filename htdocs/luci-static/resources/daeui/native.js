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

function loadResource(key) {
	return dae.callNativeApiStatus().then(function(status) {
		if (!status || !status.resources || status.resources[key] !== true)
			return { status:status || {}, resource:null };
		return dae.callNativeApiGet(key).then(function(res) {
			return { status:status, resource:parse(res) };
		});
	});
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
	loadResource:loadResource
});
