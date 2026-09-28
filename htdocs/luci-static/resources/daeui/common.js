'use strict';
'require baseclass';
'require rpc';
'require ui';

var callStatus = rpc.declare({ object: 'luci.daeui', method: 'status', expect: {} });
var callService = rpc.declare({ object: 'luci.daeui', method: 'service', params: [ 'action' ], expect: {} });
var callGetConfig = rpc.declare({ object: 'luci.daeui', method: 'get_config', expect: {} });
var callSaveConfig = rpc.declare({ object: 'luci.daeui', method: 'save_config', params: [ 'content' ], expect: {} });
var callApplyConfig = rpc.declare({ object: 'luci.daeui', method: 'apply_config', params: [ 'content' ], expect: {} });
var callRestoreLast = rpc.declare({ object: 'luci.daeui', method: 'restore_last', expect: {} });
var callGetSections = rpc.declare({ object: 'luci.daeui', method: 'get_sections', expect: {} });
var callGetLog = rpc.declare({ object: 'luci.daeui', method: 'get_log', params: [ 'limit' ], expect: {} });
var callClearLog = rpc.declare({ object: 'luci.daeui', method: 'clear_log', expect: {} });
var callDiagnose = rpc.declare({ object: 'luci.daeui', method: 'diagnose', expect: {} });
var callNativeApiStatus = rpc.declare({ object: 'luci.daeui', method: 'native_api_status', expect: {} });

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
	callService: callService,
	callGetConfig: callGetConfig,
	callSaveConfig: callSaveConfig,
	callApplyConfig: callApplyConfig,
	callRestoreLast: callRestoreLast,
	callGetSections: callGetSections,
	callGetLog: callGetLog,
	callClearLog: callClearLog,
	callDiagnose: callDiagnose,
	callNativeApiStatus: callNativeApiStatus,
	notify: notify,
	badge: badge,
	bytesFromKiB: bytesFromKiB
});
