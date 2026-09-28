'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';
'require daeui.native as native';

function cacheView(result){
	if(!result||!result.ok) return native.errorBox(result);
	var data=result.data||{},entries=data.entries||[];
	var rows=entries.map(function(e){
		var answers=(e.answers||[]).map(function(a){return a.data||a.value||'';}).filter(Boolean).join(', ');
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},E('code',{},native.text(e.domain||e.name))),
			E('td',{'class':'td'},native.text(e.type)),
			E('td',{'class':'td'},native.text(e.status)),
			E('td',{'class':'td'},E('code',{},answers||'-')),
			E('td',{'class':'td'},native.time(e.expires_at))
		]);
	});
	return native.table([_('Domain'),_('Type'),_('Status'),_('Answers'),_('Expires')],rows);
}

function logView(result){
	if(!result||!result.ok) return native.errorBox(result);
	var data=result.data||{};
	var records=data.records||data.entries||data.logs||[];
	var rows=records.map(function(e){
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},native.time(e.observed_at||e.timestamp||e.time)),
			E('td',{'class':'td'},E('code',{},native.text(e.domain||e.qname||e.name))),
			E('td',{'class':'td'},native.text(e.type||e.qtype)),
			E('td',{'class':'td'},native.text(e.status||e.rcode)),
			E('td',{'class':'td'},native.text(e.upstream||e.server)),
			E('td',{'class':'td'},native.text(e.latency_ms!==undefined?e.latency_ms:e.duration_ms))
		]);
	});
	if(!records.length && Object.keys(data).length)
		return E('pre',{'style':'white-space:pre-wrap;max-height:420px;overflow:auto'},JSON.stringify(data,null,2));
	return native.table([_('Time'),_('Domain'),_('Type'),_('Status'),_('Upstream'),_('Latency ms')],rows);
}

return view.extend({
	load:function(){
		return dae.callNativeApiStatus().then(function(status){
			var cache=status.resources&&status.resources.dns_cache===true;
			var log=status.resources&&status.resources.dns_log===true;
			return Promise.all([
				cache?dae.callNativeApiGet('dns_cache').then(native.parse):Promise.resolve(null),
				log?dae.callNativeApiGet('dns_log').then(native.parse):Promise.resolve(null)
			]).then(function(v){return {status:status,cache:v[0],log:v[1]};});
		});
	},
	refresh:function(){
		var self=this;
		return Promise.all([
			this.hasCache?dae.callNativeApiGet('dns_cache').then(native.parse):Promise.resolve(null),
			this.hasLog?dae.callNativeApiGet('dns_log').then(native.parse):Promise.resolve(null)
		]).then(function(v){
			var c=document.getElementById('native-dns-cache'); if(c&&self.hasCache) dom.content(c,cacheView(v[0]));
			var l=document.getElementById('native-dns-log'); if(l&&self.hasLog) dom.content(l,logView(v[1]));
		});
	},
	render:function(data){
		var status=data.status||{};
		this.hasCache=!!(status.resources&&status.resources.dns_cache===true);
		this.hasLog=!!(status.resources&&status.resources.dns_log===true);
		if(this.hasCache||this.hasLog) poll.add(L.bind(this.refresh,this),10);
		return E([],[
			E('h2',{},_('DNS Runtime')),
			E('div',{'class':'cbi-map-descr'},_('Read-only DNS cache and DNS log resources reported by the Native API. No cache flush, delete or query actions are sent.')),
			E('h3',{},_('DNS Cache')),
			E('div',{'id':'native-dns-cache'},this.hasCache?cacheView(data.cache):native.unavailable(status,'dns_cache')),
			E('h3',{},_('DNS Log')),
			E('div',{'id':'native-dns-log'},this.hasLog?logView(data.log):native.unavailable(status,'dns_log'))
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
