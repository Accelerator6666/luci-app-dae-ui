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
var callVersionImport = rpc.declare({ object: 'luci.daeui', method: 'version_import', params: [ 'label' ], expect: {} });
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
var callSaveManagedSection = rpc.declare({ object: 'luci.daeui', method: 'save_managed_section', params: [ 'kind', 'body', 'apply' ], expect: {} });
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

function localizedCall(fn) {
	return function() {
		return fn.apply(null, arguments).then(localizeBackendResult);
	};
}

function notify(msg, type) {
	ui.addNotification(null, E('p', {}, localizeBackendText(msg) || _('Operation completed.')), type || 'info');
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
	callStatus: localizedCall(callStatus),
	callRuntimeStats: localizedCall(callRuntimeStats),
	callService: localizedCall(callService),
	callGetConfig: localizedCall(callGetConfig),
	callSaveConfig: localizedCall(callSaveConfig),
	callApplyConfig: localizedCall(callApplyConfig),
	callRestoreLast: localizedCall(callRestoreLast),
	callGetSections: localizedCall(callGetSections),
	callListConfigFiles: localizedCall(callListConfigFiles),
	callGetConfigFile: localizedCall(callGetConfigFile),
	callSaveConfigFile: localizedCall(callSaveConfigFile),
	callCreateConfigFile: localizedCall(callCreateConfigFile),
	callListBackups: localizedCall(callListBackups),
	callDiffBackup: localizedCall(callDiffBackup),
	callRestoreBackup: localizedCall(callRestoreBackup),
	callGetLog: localizedCall(callGetLog),
	callClearLog: localizedCall(callClearLog),
	callDiagnose: localizedCall(callDiagnose),
	callNativeApiStatus: localizedCall(callNativeApiStatus),
	callNativeApiGet: localizedCall(callNativeApiGet),
	callNativeAuthStatus: localizedCall(callNativeAuthStatus),
	callSetNativeToken: localizedCall(callSetNativeToken),
	callClearNativeToken: localizedCall(callClearNativeToken),
	callNativeDnsQuery: localizedCall(callNativeDnsQuery),
	callNativeRoutingTrace: localizedCall(callNativeRoutingTrace),
	callVersionStatus: localizedCall(callVersionStatus),
	callVersionReleases: localizedCall(callVersionReleases),
	callVersionDownload: localizedCall(callVersionDownload),
	callVersionImport: localizedCall(callVersionImport),
	callVersionSwitch: localizedCall(callVersionSwitch),
	callVersionDelete: localizedCall(callVersionDelete),
	callNativeProbeStart: localizedCall(callNativeProbeStart),
	callNativeOperationGet: localizedCall(callNativeOperationGet),
	callNativeGroupGet: localizedCall(callNativeGroupGet),
	callNativeFlowGet: localizedCall(callNativeFlowGet),
	callIncludeStatus: localizedCall(callIncludeStatus),
	callGetManagedSection: localizedCall(callGetManagedSection),
	callSaveManagedSection: localizedCall(callSaveManagedSection),
	callGeodataStatus: localizedCall(callGeodataStatus),
	callUpdateGeodata: localizedCall(callUpdateGeodata),
	callRefreshGeodataPins: localizedCall(callRefreshGeodataPins),
	callPreviewManagedSection: localizedCall(callPreviewManagedSection),
	localizeBackendText: localizeBackendText,
	localizeBackendResult: localizeBackendResult,
	notify: notify,
	badge: badge,
	bytesFromKiB: bytesFromKiB,
	configUrl: configUrl,
	diagnosticsNode: diagnosticsNode
});
