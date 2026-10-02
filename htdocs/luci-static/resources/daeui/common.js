'use strict';
'require baseclass';
'require rpc';
'require ui';

var callStatus = rpc.declare({ object: 'luci.daeui', method: 'status', expect: {} });
var callRuntimeStats = rpc.declare({ object: 'luci.daeui', method: 'runtime_stats', expect: {} });
var callService = rpc.declare({ object: 'luci.daeui', method: 'service', params: [ 'action' ], expect: {} });
var callGetConfig = rpc.declare({ object: 'luci.daeui', method: 'get_config', expect: {} });
var callSaveConfig = rpc.declare({ object: 'luci.daeui', method: 'save_config', params: [ 'content' ], expect: {} });
var callApplyConfig = rpc.declare({ object: 'luci.daeui', method: 'apply_config', params: [ 'content' ], expect: {} });
var callRestoreLast = rpc.declare({ object: 'luci.daeui', method: 'restore_last', expect: {} });
var callGetSections = rpc.declare({ object: 'luci.daeui', method: 'get_sections', expect: {} });
var callListConfigFiles = rpc.declare({ object: 'luci.daeui', method: 'list_config_files', expect: {} });
var callGetConfigFile = rpc.declare({ object: 'luci.daeui', method: 'get_config_file', params: [ 'path' ], expect: {} });
var callSaveConfigFile = rpc.declare({ object: 'luci.daeui', method: 'save_config_file', params: [ 'path', 'content', 'apply' ], expect: {} });
var callCreateConfigFile = rpc.declare({ object: 'luci.daeui', method: 'create_config_file', params: [ 'name', 'content', 'apply' ], expect: {} });
var callListBackups = rpc.declare({ object: 'luci.daeui', method: 'list_backups', expect: {} });
var callDiffBackup = rpc.declare({ object: 'luci.daeui', method: 'diff_backup', params: [ 'path' ], expect: {} });
var callRestoreBackup = rpc.declare({ object: 'luci.daeui', method: 'restore_backup', params: [ 'path', 'apply' ], expect: {} });
var callGetLog = rpc.declare({ object: 'luci.daeui', method: 'get_log', params: [ 'limit' ], expect: {} });
var callClearLog = rpc.declare({ object: 'luci.daeui', method: 'clear_log', expect: {} });
var callDiagnose = rpc.declare({ object: 'luci.daeui', method: 'diagnose', expect: {} });
var callNativeApiStatus = rpc.declare({ object: 'luci.daeui', method: 'native_api_status', expect: {} });
var callNativeApiGetRaw = rpc.declare({
	object: 'luci.daeui',
	method: 'native_api_get',
	params: [
		'resource', 'limit', 'cursor', 'type', 'src', 'network', 'state',
		'group_id', 'connection_id', 'name', 'domain', 'record_type', 'include_expired'
	],
	expect: {}
});
var callNativeAuthStatus = rpc.declare({ object: 'luci.daeui', method: 'native_auth_status', expect: {} });
var callSetNativeToken = rpc.declare({ object: 'luci.daeui', method: 'set_native_token', params: [ 'token' ], expect: {} });
var callClearNativeToken = rpc.declare({ object: 'luci.daeui', method: 'clear_native_token', expect: {} });
var callNativeDnsQuery = rpc.declare({
	object: 'luci.daeui',
	method: 'native_dns_query',
	params: [ 'domain', 'record_types', 'upstream', 'cache_mode' ],
	expect: {}
});
var callNativeRoutingTrace = rpc.declare({
	object: 'luci.daeui',
	method: 'native_routing_trace',
	params: [ 'domain', 'dst_ip', 'network', 'dst_port', 'src_ip', 'src_port', 'pname', 'resolve' ],
	expect: {}
});
var callVersionStatus = rpc.declare({ object: 'luci.daeui', method: 'version_status', expect: {} });
var callVersionReleases = rpc.declare({ object: 'luci.daeui', method: 'version_releases', expect: {} });
var callVersionDownload = rpc.declare({ object: 'luci.daeui', method: 'version_download', params: [ 'tag', 'asset' ], expect: {} });
var callVersionImport = rpc.declare({ object: 'luci.daeui', method: 'version_import', params: [ 'label', 'filename' ], expect: {} });
var callVersionSwitch = rpc.declare({ object: 'luci.daeui', method: 'version_switch', params: [ 'slot' ], expect: {} });
var callVersionDelete = rpc.declare({ object: 'luci.daeui', method: 'version_delete', params: [ 'slot' ], expect: {} });
var callNativeProbeStart = rpc.declare({
	object: 'luci.daeui',
	method: 'native_probe_start',
	params: [ 'target_type', 'target_id', 'kind', 'transport', 'ip_version', 'warmth', 'members_json' ],
	expect: {}
});
var callNativeOperationGet = rpc.declare({ object: 'luci.daeui', method: 'native_operation_get', params: [ 'operation_id' ], expect: {} });
var callNativeGroupGet = rpc.declare({ object: 'luci.daeui', method: 'native_group_get', params: [ 'group_id' ], expect: {} });
var callNativeFlowGet = rpc.declare({ object: 'luci.daeui', method: 'native_flow_get', params: [ 'flow_id' ], expect: {} });

function callNativeApiGet(resource, opts) {
	opts = opts || {};
	return callNativeApiGetRaw(
		resource,
		Number(opts.limit || 0),
		opts.cursor || '',
		opts.type || '',
		opts.src || '',
		opts.network || '',
		opts.state || '',
		opts.group_id || '',
		opts.connection_id || '',
		opts.name || '',
		opts.domain || '',
		opts.record_type || '',
		!!opts.include_expired
	);
}
var callIncludeStatus = rpc.declare({ object: 'luci.daeui', method: 'include_status', expect: {} });
var callGetManagedSection = rpc.declare({ object: 'luci.daeui', method: 'get_managed_section', params: [ 'kind' ], expect: {} });
var callSaveManagedSection = rpc.declare({ object: 'luci.daeui', method: 'save_managed_section', params: [ 'kind', 'body', 'apply', 'revision' ], expect: {} });
var callGeodataStatus = rpc.declare({ object: 'luci.daeui', method: 'geodata_status', expect: {} });
var callUpdateGeodata = rpc.declare({ object: 'luci.daeui', method: 'update_geodata', expect: {} });
var callRefreshGeodataPins = rpc.declare({ object: 'luci.daeui', method: 'refresh_geodata_pins', expect: {} });
var callPreviewManagedSection = rpc.declare({ object: 'luci.daeui', method: 'preview_managed_section', params: [ 'kind', 'body' ], expect: {} });

function localizeBackendText(msg) {
	if (typeof msg !== 'string' || !msg)
		return msg;

	var translated = _(msg);
	if (translated !== msg)
		return translated;

	var prefixes = [
		'Action completed: ',
		'Download failed: ',
		'SHA256 mismatch: ',
		'Unable to backup existing ',
		'Unable to install ',
		'Native API returned HTTP '
	];

	for (var i = 0; i < prefixes.length; i++) {
		if (msg.indexOf(prefixes[i]) === 0)
			return _(prefixes[i]) + msg.slice(prefixes[i].length);
	}

	return msg;
}

function localizeBackendResult(res) {
	if (!res || typeof res !== 'object')
		return res;

	if (typeof res.message === 'string')
		res.message = localizeBackendText(res.message);
	if (typeof res.error === 'string')
		res.error = localizeBackendText(res.error);

	return res;
}

var errorHistory = [];

function rememberError(record) {
	record = record || {};
	var entry = {
		time: new Date().toISOString(),
		operation: String(record.operation || 'unknown'),
		status: Number(record.status || 0),
		request_id: String(record.request_id || record.requestId || ''),
		error: localizeBackendText(record.error || ''),
		message: localizeBackendText(record.message || '')
	};
	var previous = errorHistory.length ? errorHistory[errorHistory.length - 1] : null;
	if (previous && previous.operation === entry.operation && previous.status === entry.status &&
		previous.request_id === entry.request_id && previous.error === entry.error && previous.message === entry.message)
		return previous;
	errorHistory.push(entry);
	if (errorHistory.length > 20) errorHistory.splice(0, errorHistory.length - 20);
	return entry;
}

function errorText(entry) {
	entry = entry || {};
	var lines = [];
	if (entry.time) lines.push('time: ' + entry.time);
	if (entry.operation) lines.push('operation: ' + entry.operation);
	if (entry.status) lines.push('status: ' + entry.status);
	if (entry.request_id) lines.push('request_id: ' + entry.request_id);
	if (entry.error) lines.push('error: ' + entry.error);
	if (entry.message) lines.push('message: ' + entry.message);
	return lines.join('\n');
}

function copyText(text) {
	text = String(text || '');
	if (navigator.clipboard && window.isSecureContext)
		return navigator.clipboard.writeText(text);
	return new Promise(function(resolve, reject) {
		try {
			var ta = E('textarea', {
				'style':'position:fixed;left:-9999px;top:-9999px',
				'readonly':''
			}, text);
			document.body.appendChild(ta);
			ta.select();
			var ok = document.execCommand('copy');
			document.body.removeChild(ta);
			if (!ok) throw new Error('copy failed');
			resolve();
		} catch (e) {
			reject(e);
		}
	});
}

function localizedCall(name, fn) {
	return function() {
		return fn.apply(null, arguments).then(function(res) {
			res = localizeBackendResult(res);
			if (res && (res.ok === false || res.error))
				rememberError({
					operation:name,
					status:res.status,
					request_id:res.request_id,
					error:res.error,
					message:res.message
				});
			return res;
		}).catch(function(err) {
			rememberError({ operation:name, error:err && err.message ? err.message : String(err || '') });
			throw err;
		});
	};
}

function notify(msg, type) {
	var text = localizeBackendText(msg) || _('Operation completed.');
	if (type === 'error') {
		var latest = errorHistory.length ? errorHistory[errorHistory.length - 1] : rememberError({ operation:'notification', error:text });
		ui.addNotification(null, E('div', {}, [
			E('p', {}, text),
			E('button', {
				'class':'btn cbi-button',
				'click':function() {
					return copyText(errorText(latest)).then(function() {
						ui.addNotification(null, E('p', {}, _('Copied error details to clipboard.')), 'info');
					}).catch(function() {
						ui.addNotification(null, E('p', {}, _('Unable to copy error details.')), 'error');
					});
				}
			}, _('Copy error'))
		]), type);
		return;
	}
	ui.addNotification(null, E('p', {}, text), type || 'info');
}

function visiblePoll(fn) {
	return function() {
		if (typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden'))
			return Promise.resolve();
		return fn.apply(this, arguments);
	};
}

function recentErrors() {
	return errorHistory.slice();
}

function clearRecentErrors() {
	errorHistory.splice(0, errorHistory.length);
}

function copyRecentErrors() {
	var entries = recentErrors();
	if (!entries.length) return Promise.reject(new Error(_('No recent errors.')));
	return copyText(entries.map(errorText).join('\n\n---\n\n'));
}

function badge(text, state) {
	var cls = state === 'PASS' || state === true ? 'label success' :
		(state === 'WARN' ? 'label notice' : 'label warning');
	return E('span', { 'class': cls, 'style': 'display:inline-block;min-width:84px;text-align:center' }, text);
}

function bytesFromKiB(kib) {
	var n = Number(kib || 0);
	return n ? (n / 1024).toFixed(1) + ' MiB' : '-';
}

function configUrl(path, line) {
	var url = L.url('admin/services/dae-ui/files');
	var q = [];
	if (path) q.push('path=' + encodeURIComponent(path));
	if (line) q.push('line=' + encodeURIComponent(String(line)));
	return url + (q.length ? '?' + q.join('&') : '');
}

function diagnosticsNode(items) {
	items = items || [];
	if (!items.length) return null;
	return E('div', { 'class':'cbi-section' }, [
		E('h4', {}, _('Validation diagnostics')),
		items.map(function(d) {
			var label = (d.file || _('Main config')) +
				(d.line ? ':' + d.line : '') +
				(d.column ? ':' + d.column : '');
			return E('div', { 'style':'margin:6px 0' }, [
				d.file ? E('a', { 'href':configUrl(d.file, d.line) }, E('code', {}, label)) : E('code', {}, label),
				E('span', {}, ' — ' + (d.message || d.raw || _('Validation error')))
			]);
		})
	]);
}

return baseclass.extend({
	callStatus: localizedCall('status', callStatus),
	callRuntimeStats: localizedCall('runtime_stats', callRuntimeStats),
	callService: localizedCall('service', callService),
	callGetConfig: localizedCall('get_config', callGetConfig),
	callSaveConfig: localizedCall('save_config', callSaveConfig),
	callApplyConfig: localizedCall('apply_config', callApplyConfig),
	callRestoreLast: localizedCall('restore_last', callRestoreLast),
	callGetSections: localizedCall('get_sections', callGetSections),
	callListConfigFiles: localizedCall('list_config_files', callListConfigFiles),
	callGetConfigFile: localizedCall('get_config_file', callGetConfigFile),
	callSaveConfigFile: localizedCall('save_config_file', callSaveConfigFile),
	callCreateConfigFile: localizedCall('create_config_file', callCreateConfigFile),
	callListBackups: localizedCall('list_backups', callListBackups),
	callDiffBackup: localizedCall('diff_backup', callDiffBackup),
	callRestoreBackup: localizedCall('restore_backup', callRestoreBackup),
	callGetLog: localizedCall('get_log', callGetLog),
	callClearLog: localizedCall('clear_log', callClearLog),
	callDiagnose: localizedCall('diagnose', callDiagnose),
	callNativeApiStatus: localizedCall('native_api_status', callNativeApiStatus),
	callNativeApiGet: localizedCall('native_api_get', callNativeApiGet),
	callNativeAuthStatus: localizedCall('native_auth_status', callNativeAuthStatus),
	callSetNativeToken: localizedCall('set_native_token', callSetNativeToken),
	callClearNativeToken: localizedCall('clear_native_token', callClearNativeToken),
	callNativeDnsQuery: localizedCall('native_dns_query', callNativeDnsQuery),
	callNativeRoutingTrace: localizedCall('native_routing_trace', callNativeRoutingTrace),
	callVersionStatus: localizedCall('version_status', callVersionStatus),
	callVersionReleases: localizedCall('version_releases', callVersionReleases),
	callVersionDownload: localizedCall('version_download', callVersionDownload),
	callVersionImport: localizedCall('version_import', callVersionImport),
	callVersionSwitch: localizedCall('version_switch', callVersionSwitch),
	callVersionDelete: localizedCall('version_delete', callVersionDelete),
	callNativeProbeStart: localizedCall('native_probe_start', callNativeProbeStart),
	callNativeOperationGet: localizedCall('native_operation_get', callNativeOperationGet),
	callNativeGroupGet: localizedCall('native_group_get', callNativeGroupGet),
	callNativeFlowGet: localizedCall('native_flow_get', callNativeFlowGet),
	callIncludeStatus: localizedCall('include_status', callIncludeStatus),
	callGetManagedSection: localizedCall('get_managed_section', callGetManagedSection),
	callSaveManagedSection: localizedCall('save_managed_section', callSaveManagedSection),
	callGeodataStatus: localizedCall('geodata_status', callGeodataStatus),
	callUpdateGeodata: localizedCall('update_geodata', callUpdateGeodata),
	callRefreshGeodataPins: localizedCall('refresh_geodata_pins', callRefreshGeodataPins),
	callPreviewManagedSection: localizedCall('preview_managed_section', callPreviewManagedSection),
	localizeBackendText: localizeBackendText,
	localizeBackendResult: localizeBackendResult,
	notify: notify,
	badge: badge,
	bytesFromKiB: bytesFromKiB,
	configUrl: configUrl,
	diagnosticsNode: diagnosticsNode,
	visiblePoll: visiblePoll,
	recentErrors: recentErrors,
	clearRecentErrors: clearRecentErrors,
	copyRecentErrors: copyRecentErrors,
	copyText: copyText,
	errorText: errorText
});
