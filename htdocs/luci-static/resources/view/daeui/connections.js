'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';
'require daeui.native as native';

function rows(data) {
	var out = [];
	[ ['tcp', data && data.tcp], ['udp', data && data.udp] ].forEach(function(pair) {
		(pair[1] || []).forEach(function(c) {
			var target = c.domain || c.dst || c.destination || '-';
			var proc = c.pname || c.process || c.process_name || '-';
			out.push(E('tr', { 'class':'tr' }, [
				E('td', { 'class':'td' }, pair[0].toUpperCase()),
				E('td', { 'class':'td' }, native.text(c.state)),
				E('td', { 'class':'td' }, E('code', {}, native.text(c.src))),
				E('td', { 'class':'td' }, E('code', {}, native.text(target))),
				E('td', { 'class':'td' }, native.text(c.outbound)),
				E('td', { 'class':'td' }, native.text(proc)),
				E('td', { 'class':'td' }, native.humanRate(c.upload_bytes_per_second)),
				E('td', { 'class':'td' }, native.humanRate(c.download_bytes_per_second))
			]));
		});
	});
	return out;
}

function renderData(result) {
	if (!result || !result.ok) return native.errorBox(result);
	var data=result.data||{};
	var totalTcp=data.total_tcp !== undefined ? data.total_tcp : ((data.tcp||[]).length);
	var totalUdp=data.total_udp !== undefined ? data.total_udp : ((data.udp||[]).length);
	return E([],[
		E('div', { 'class':'cbi-map-descr' }, _('TCP: ') + totalTcp + ' · ' + _('UDP: ') + totalUdp + (data.truncated ? ' · ' + _('truncated') : '')),
		native.table(
			[_('Network'),_('State'),_('Source'),_('Target'),_('Outbound'),_('Process'),_('Upload'),_('Download')],
			rows(data)
		)
	]);
}

return view.extend({
	load:function(){ return native.loadResource('connections'); },
	refresh:function(){
		return dae.callNativeApiGet('connections').then(function(res){
			var box=document.getElementById('native-connections');
			if(box) dom.content(box,renderData(native.parse(res)));
		});
	},
	render:function(data){
		var status=data.status||{};
		var available=status.resources&&status.resources.connections===true;
		if(available) poll.add(L.bind(this.refresh,this),3);
		return E([],[
			E('h2',{},_('Native Connections')),
			E('div',{'class':'cbi-map-descr'},_('Read-only connection snapshot from /api/v1/connections. This page never sends close or other mutation requests.')),
			E('div',{'id':'native-connections'},available?renderData(data.resource):native.unavailable(status,'connections'))
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
