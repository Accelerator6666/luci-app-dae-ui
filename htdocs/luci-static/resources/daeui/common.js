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
var callPreviewManagedSection = rpc.declare({ object: 'luci.daeui', method: 'preview_managed_section', params: [ 'kind', 'body' ], expect: {} });

function notify(msg, type) {
	ui.addNotification(null, E('p', {}, msg || _('Operation completed.')), type || 'info');
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

return baseclass.extend({
	callStatus: callStatus,
	callRuntimeStats: callRuntimeStats,
	callService: callService,
	callGetConfig: callGetConfig,
	callSaveConfig: callSaveConfig,
	callApplyConfig: callApplyConfig,
	callRestoreLast: callRestoreLast,
	callGetSections: callGetSections,
	callListConfigFiles: callListConfigFiles,
	callGetConfigFile: callGetConfigFile,
	callSaveConfigFile: callSaveConfigFile,
	callCreateConfigFile: callCreateConfigFile,
	callListBackups: callListBackups,
	callDiffBackup: callDiffBackup,
	callRestoreBackup: callRestoreBackup,
	callGetLog: callGetLog,
	callClearLog: callClearLog,
	callDiagnose: callDiagnose,
	callNativeApiStatus: callNativeApiStatus,
	callNativeApiGet: callNativeApiGet,
	callNativeAuthStatus: callNativeAuthStatus,
	callSetNativeToken: callSetNativeToken,
	callClearNativeToken: callClearNativeToken,
	callIncludeStatus: callIncludeStatus,
	callGetManagedSection: callGetManagedSection,
	callSaveManagedSection: callSaveManagedSection,
	callGeodataStatus: callGeodataStatus,
	callUpdateGeodata: callUpdateGeodata,
	callPreviewManagedSection: callPreviewManagedSection,
	notify: notify,
	badge: badge,
	bytesFromKiB: bytesFromKiB
});
