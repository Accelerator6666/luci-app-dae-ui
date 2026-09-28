'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';
'require daeui.native as native';

function unwrapGroups(data) {
	if (Array.isArray(data)) return data;
	return (data && data.groups) || [];
}

function selectText(group, network) {
	var s=group&&group.runtime&&group.runtime.selection&&group.runtime.selection[network];
	if(!s) return '-';
	return native.text(s.member_id||s.resolved_leaf_node_id||s);
}

function renderData(groupsResult,outResult) {
	if(!groupsResult||!groupsResult.ok) return native.errorBox(groupsResult);
	var groups=unwrapGroups(groupsResult.data);
	var outbounds=(outResult&&outResult.ok&&outResult.data&&outResult.data.outbounds)||[];
	var byName={};
	outbounds.forEach(function(o){byName[o.name]=o;});
	var rows=groups.map(function(g){
		var use=byName[g.name]||{};
		var policy=g.policy&&typeof g.policy==='object'?(g.policy.kind||g.policy.type||JSON.stringify(g.policy)):native.text(g.policy);
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},native.text(g.name||g.id)),
			E('td',{'class':'td'},native.text(policy)),
			E('td',{'class':'td'},selectText(g,'tcp')),
			E('td',{'class':'td'},selectText(g,'udp')),
			E('td',{'class':'td'},String((g.members||[]).length)),
			E('td',{'class':'td'},native.text(use.active!==undefined?use.active:use.connections)),
			E('td',{'class':'td'},native.humanBytes(use.upload_bytes)),
			E('td',{'class':'td'},native.humanBytes(use.download_bytes))
		]);
	});
	return native.table([_('Policy'),_('Kind'),_('TCP selection'),_('UDP selection'),_('Members'),_('Active'),_('Upload total'),_('Download total')],rows);
}

return view.extend({
	load:function(){
		return dae.callNativeApiStatus().then(function(status){
			if(!status.resources||status.resources.groups!==true) return {status:status,groups:null,outbounds:null};
			var groupP=dae.callNativeApiGet('groups').then(native.parse);
			var outP=status.resources.runtime_outbounds===true?dae.callNativeApiGet('runtime_outbounds').then(native.parse):Promise.resolve(null);
			return Promise.all([groupP,outP]).then(function(v){return {status:status,groups:v[0],outbounds:v[1]};});
		});
	},
	refresh:function(){
		var self=this;
		return Promise.all([
			dae.callNativeApiGet('groups').then(native.parse),
			this.hasOutbounds?dae.callNativeApiGet('runtime_outbounds').then(native.parse):Promise.resolve(null)
		]).then(function(v){
			var box=document.getElementById('native-policies');
			if(box) dom.content(box,renderData(v[0],v[1]));
		});
	},
	render:function(data){
		var status=data.status||{},available=status.resources&&status.resources.groups===true;
		this.hasOutbounds=!!(status.resources&&status.resources.runtime_outbounds===true);
		if(available) poll.add(L.bind(this.refresh,this),5);
		return E([],[
			E('h2',{},_('Runtime Policies')),
			E('div',{'class':'cbi-map-descr'},_('Read-only current group selection plus outbound counters when the backend reports runtime_outbounds. No policy switch requests are sent.')),
			E('div',{'id':'native-policies'},available?renderData(data.groups,data.outbounds):native.unavailable(status,'groups'))
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
