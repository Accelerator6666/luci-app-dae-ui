'use strict';
'require view';
'require poll';
'require ui';
'require dom';
'require daeui.common as dae';
'require daeui.native as nativeApi';

function row(k,v){
	return E('div',{'class':'tr'},[
		E('div',{'class':'td left','style':'width:220px;font-weight:600'},k),
		E('div',{'class':'td left'},v)
	]);
}

function humanSeconds(v){
	var n=Number(v||0);
	if(!n) return '-';
	var d=Math.floor(n/86400); n%=86400;
	var h=Math.floor(n/3600); n%=3600;
	var m=Math.floor(n/60);
	var parts=[];
	if(d) parts.push(d+'d');
	if(h||d) parts.push(h+'h');
	parts.push(m+'m');
	return parts.join(' ');
}

function parseGeneration(res){
	if(!res || !res.ok || !res.data) return '';
	var v=res.data.generation_id;
	return v===null || v===undefined ? '' : String(v);
}

function nativeSnapshot(){
	return dae.callNativeApiStatus().then(function(status){
		status=status||{};
		var resources=status.resources||{};
		function load(name){
			if(resources[name]!==true) return Promise.resolve(null);
			return dae.callNativeApiGet(name).then(nativeApi.parse);
		}
		return Promise.all([load('config'),load('rules'),load('dns_rules')]).then(function(parts){
			var entries=[
				{key:'config',value:parseGeneration(parts[0])},
				{key:'rules',value:parseGeneration(parts[1])},
				{key:'dns',value:parseGeneration(parts[2])}
			];
			var ids=[],reported=0;
			entries.forEach(function(e){
				if(!e.value) return;
				reported++;
				if(ids.indexOf(e.value)<0) ids.push(e.value);
			});
			var state=reported===0
				? {text:_('Not reported'),state:'WARN'}
				: reported===1
					? {text:_('Only one generation reported'),state:'WARN'}
					: ids.length===1
						? {text:_('Consistent'),state:true}
						: {text:_('Mismatch'),state:false};
			return {status:status,entries:entries,reported:reported,ids:ids,state:state};
		});
	}).catch(function(){
		return {status:{},entries:[],reported:0,ids:[],state:{text:_('Unavailable'),state:'WARN'}};
	});
}

function nativeApiState(snapshot){
	var status=(snapshot&&snapshot.status)||{};
	if(status.contract_ready) return {text:_('Available'),state:true};
	if(status.capabilities_status===401) return {text:_('Auth required'),state:'WARN'};
	return {text:_('Not detected'),state:'WARN'};
}

function nativeDetail(snapshot){
	var entries=(snapshot&&snapshot.entries)||[];
	var parts=[];
	entries.forEach(function(e){ if(e.value) parts.push(e.key+'='+e.value); });
	return parts.length ? parts.join(' · ') : _('No generation IDs reported');
}

return view.extend({
	load:function(){return Promise.all([dae.callStatus(),nativeSnapshot()]);},
	action:function(action){
		ui.showModal(_('DAE'),[E('p',{'class':'spinning'},_('Applying action…'))]);
		return dae.callService(action).then(function(res){
			ui.hideModal();
			dae.notify((res&&(res.message||res.error||res.output))||_('Action finished.'),res&&res.ok?'info':'error');
			return dae.callStatus();
		}).then(this.update.bind(this));
	},
	update:function(data){
		var status=data||{};
		var map={
			'dae-running':dae.badge(status.running?_('Running'):_('Stopped'),!!status.running),
			'dae-config':dae.badge(status.config_valid?_('Valid'):_('Invalid'),!!status.config_valid),
			'dae-dae0':dae.badge(status.dae0?_('Present'):_('Missing'),status.dae0?'PASS':'WARN')
		};
		Object.keys(map).forEach(function(id){var n=document.getElementById(id);if(n)dom.content(n,map[id]);});
		var vals={
			'dae-pid':status.pid||'-',
			'dae-memory':dae.bytesFromKiB(status.memory_kb),
			'dae-uptime':humanSeconds(status.process_uptime),
			'dae-files':String(status.config_files||0),
			'dae-route':status.default_route||'-',
			'dae-selected-slot':status.selected_slot||'system',
			'dae-last-good-slot':status.last_good_slot||'system',
			'dae-running-binary':status.running_binary||'-'
		};
		Object.keys(vals).forEach(function(id){var n=document.getElementById(id);if(n)n.textContent=vals[id];});
		var i=document.getElementById('dae-interfaces'); if(i)i.textContent=status.interfaces||_('No interface information.');
	},
	updateNative:function(snapshot){
		snapshot=snapshot||{};
		var api=nativeApiState(snapshot);
		var apiNode=document.getElementById('dae-native-api');
		if(apiNode) dom.content(apiNode,dae.badge(api.text,api.state));
		var genNode=document.getElementById('dae-native-generation');
		if(genNode) dom.content(genNode,dae.badge((snapshot.state&&snapshot.state.text)||_('Not reported'),snapshot.state&&snapshot.state.state||'WARN'));
		var detail=document.getElementById('dae-native-generation-detail');
		if(detail) detail.textContent=nativeDetail(snapshot);
	},
	render:function(data){
		data=data||[];
		var status=data[0]||{};
		var native=data[1]||{};
		poll.add(L.bind(function(){return dae.callStatus().then(this.update.bind(this));},this),5);
		poll.add(L.bind(function(){return nativeSnapshot().then(this.updateNative.bind(this));},this),15);
		return E([],[
			E('h2',{},_('DAE Overview')),
			E('div',{'class':'cbi-map-descr'},_('Live process, configuration and network state. Refreshes automatically every 5 seconds.')),
			E('div',{'class':'table'},[
				row(_('Service'),E('span',{'id':'dae-running'},dae.badge(status.running?_('Running'):_('Stopped'),!!status.running))),
				row(_('PID'),E('span',{'id':'dae-pid'},String(status.pid||'-'))),
				row(_('Memory'),E('span',{'id':'dae-memory'},dae.bytesFromKiB(status.memory_kb))),
				row(_('Process uptime'),E('span',{'id':'dae-uptime'},humanSeconds(status.process_uptime))),
				row(_('Version'),status.version||'-'),
				row(_('Binary entry point'),E('code',{},status.binary||'/usr/bin/dae')),
				row(_('Version manager'),dae.badge(status.version_manager_enabled?_('Enabled'):_('Not enabled'),status.version_manager_enabled?true:'WARN')),
				row(_('Selected slot'),E('code',{'id':'dae-selected-slot'},status.selected_slot||'system')),
				row(_('Last-good slot'),E('code',{'id':'dae-last-good-slot'},status.last_good_slot||'system')),
				row(_('Running binary'),E('code',{'id':'dae-running-binary'},status.running_binary||'-')),
				row(_('Configuration'),E('code',{},status.config_file||'/etc/dae/config.dae')),
				row(_('Discovered .dae files'),E('span',{'id':'dae-files'},String(status.config_files||0))),
				row(_('Validation'),E('span',{'id':'dae-config'},dae.badge(status.config_valid?_('Valid'):_('Invalid'),!!status.config_valid))),
				row(_('eBPF interface dae0'),E('span',{'id':'dae-dae0'},dae.badge(status.dae0?_('Present'):_('Missing'),status.dae0?'PASS':'WARN'))),
				row(_('Native API'),E('span',{'id':'dae-native-api'},dae.badge(nativeApiState(native).text,nativeApiState(native).state))),
				row(_('Runtime generation'),E('span',{},[
					E('span',{'id':'dae-native-generation'},dae.badge((native.state&&native.state.text)||_('Not reported'),native.state&&native.state.state||'WARN')),
					E('br'),
					E('code',{'id':'dae-native-generation-detail','style':'font-size:.9em'},nativeDetail(native))
				])),
				row(_('Default route'),E('code',{'id':'dae-route'},status.default_route||'-')),
				row(_('Latest backup'),status.last_backup||_('None'))
			]),
			E('h3',{},_('Interfaces')),
			E('pre',{'id':'dae-interfaces','style':'white-space:pre-wrap;max-height:260px;overflow:auto'},status.interfaces||_('No interface information.')),
			E('div',{'class':'cbi-page-actions'},[
				E('button',{'class':'btn cbi-button cbi-button-action','click':ui.createHandlerFn(this,this.action,'start')},_('Start')),' ',
				E('button',{'class':'btn cbi-button cbi-button-action','click':ui.createHandlerFn(this,this.action,'reload')},_('Hot Reload')),' ',
				E('button',{'class':'btn cbi-button cbi-button-action','click':ui.createHandlerFn(this,this.action,'restart')},_('Restart')),' ',
				E('button',{'class':'btn cbi-button','click':ui.createHandlerFn(this,this.action,'suspend')},_('Suspend')),' ',
				E('button',{'class':'btn cbi-button cbi-button-negative','click':ui.createHandlerFn(this,this.action,'stop')},_('Stop'))
			])
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
