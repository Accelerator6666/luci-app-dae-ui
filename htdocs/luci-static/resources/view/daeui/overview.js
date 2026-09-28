'use strict';
'require view';
'require poll';
'require ui';
'require dom';
'require daeui.common as dae';

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

return view.extend({
	load:function(){return dae.callStatus();},
	action:function(action){
		ui.showModal(_('DAE'),[E('p',{'class':'spinning'},_('Applying action…'))]);
		return dae.callService(action).then(function(res){
			ui.hideModal();
			dae.notify((res&&(res.message||res.error||res.output))||_('Action finished.'),res&&res.ok?'info':'error');
			return dae.callStatus();
		}).then(this.update.bind(this));
	},
	update:function(data){
		var map={
			'dae-running':dae.badge(data.running?_('Running'):_('Stopped'),!!data.running),
			'dae-config':dae.badge(data.config_valid?_('Valid'):_('Invalid'),!!data.config_valid),
			'dae-dae0':dae.badge(data.dae0?_('Present'):_('Missing'),data.dae0?'PASS':'WARN')
		};
		Object.keys(map).forEach(function(id){var n=document.getElementById(id);if(n)dom.content(n,map[id]);});
		var vals={
			'dae-pid':data.pid||'-',
			'dae-memory':dae.bytesFromKiB(data.memory_kb),
			'dae-uptime':humanSeconds(data.process_uptime),
			'dae-files':String(data.config_files||0),
			'dae-route':data.default_route||'-'
		};
		Object.keys(vals).forEach(function(id){var n=document.getElementById(id);if(n)n.textContent=vals[id];});
		var i=document.getElementById('dae-interfaces'); if(i)i.textContent=data.interfaces||_('No interface information.');
	},
	render:function(data){
		data=data||{};
		poll.add(L.bind(function(){return dae.callStatus().then(this.update.bind(this));},this),5);
		return E([],[
			E('h2',{},_('DAE Overview')),
			E('div',{'class':'cbi-map-descr'},_('Live process, configuration and network state. Refreshes automatically every 5 seconds.')),
			E('div',{'class':'table'},[
				row(_('Service'),E('span',{'id':'dae-running'},dae.badge(data.running?_('Running'):_('Stopped'),!!data.running))),
				row(_('PID'),E('span',{'id':'dae-pid'},String(data.pid||'-'))),
				row(_('Memory'),E('span',{'id':'dae-memory'},dae.bytesFromKiB(data.memory_kb))),
				row(_('Process uptime'),E('span',{'id':'dae-uptime'},humanSeconds(data.process_uptime))),
				row(_('Version'),data.version||'-'),
				row(_('Binary'),E('code',{},data.binary||'/usr/bin/dae')),
				row(_('Configuration'),E('code',{},data.config_file||'/etc/dae/config.dae')),
				row(_('Discovered .dae files'),E('span',{'id':'dae-files'},String(data.config_files||0))),
				row(_('Validation'),E('span',{'id':'dae-config'},dae.badge(data.config_valid?_('Valid'):_('Invalid'),!!data.config_valid))),
				row(_('eBPF interface dae0'),E('span',{'id':'dae-dae0'},dae.badge(data.dae0?_('Present'):_('Missing'),data.dae0?'PASS':'WARN'))),
				row(_('Default route'),E('code',{'id':'dae-route'},data.default_route||'-')),
				row(_('Latest backup'),data.last_backup||_('None'))
			]),
			E('h3',{},_('Interfaces')),
			E('pre',{'id':'dae-interfaces','style':'white-space:pre-wrap;max-height:260px;overflow:auto'},data.interfaces||_('No interface information.')),
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
