'use strict';
'require view';
'require poll';
'require daeui.common as dae';
'require daeui.native as native';

function cacheDomain(e) {
	return e.domain || e.name || '-';
}

function cacheAnswers(e) {
	return (e.answers || []).map(function(a) {
		return a.data || a.value || '';
	}).filter(Boolean).join(', ');
}

function cacheGrid(entries) {
	return native.dataGrid(entries, {
		searchPlaceholder: _('Search cached domain or answer…'),
		pageSize: 50,
		filters: [
			{ key:'type', title:_('type'), value:function(e){ return native.text(e.type, ''); } },
			{ key:'status', title:_('status'), value:function(e){ return native.text(e.status, ''); } }
		],
		search:function(e) {
			return [ cacheDomain(e), e.type, e.status, cacheAnswers(e) ].join(' ');
		},
		columns:[
			{ key:'domain', title:_('Domain'), value:cacheDomain, render:function(e){ return E('code',{},native.text(cacheDomain(e))); } },
			{ key:'type', title:_('Type'), value:function(e){ return native.text(e.type,''); } },
			{ key:'status', title:_('Status'), value:function(e){ return native.text(e.status,''); } },
			{ key:'answers', title:_('Answers'), value:cacheAnswers, render:function(e){ return E('code',{},cacheAnswers(e)||'-'); } },
			{ key:'expires', title:_('Expires'), value:function(e){ return e.expires_at||''; }, render:function(e){ return native.time(e.expires_at); } }
		]
	});
}

function logName(e) {
	return (e.question && e.question.name) || e.domain || e.qname || e.name || '-';
}

function logType(e) {
	return (e.question && e.question.type) || e.type || e.qtype || '-';
}

function logGrid(records) {
	return native.dataGrid(records, {
		searchPlaceholder: _('Search DNS name, source, upstream or status…'),
		pageSize: 50,
		filters:[
			{ key:'type', title:_('type'), value:logType },
			{ key:'status', title:_('status'), value:function(e){ return native.text(e.status || e.rcode, ''); } },
			{ key:'cached', title:_('cache'), value:function(e){ return e.cached === true ? 'cached' : 'upstream'; }, options:[
				{value:'cached',label:_('Cached')},
				{value:'upstream',label:_('Not cached')}
			] }
		],
		search:function(e) {
			return [ logName(e), logType(e), e.src, e.status, e.rcode, e.upstream ].join(' ');
		},
		columns:[
			{ key:'time', title:_('Time'), value:function(e){ return e.observed_at||e.timestamp||e.time||''; }, render:function(e){ return native.time(e.observed_at||e.timestamp||e.time); } },
			{ key:'domain', title:_('Domain'), value:logName, render:function(e){ return E('code',{},native.text(logName(e))); } },
			{ key:'type', title:_('Type'), value:logType },
			{ key:'source', title:_('Source'), value:function(e){ return native.text(e.src,''); }, render:function(e){ return E('code',{},native.text(e.src)); } },
			{ key:'status', title:_('Status'), value:function(e){ return native.text(e.status||e.rcode,''); } },
			{ key:'upstream', title:_('Upstream'), value:function(e){ return native.text(e.upstream,''); } },
			{ key:'latency', title:_('Latency'), numeric:true, value:function(e){ return Number(e.elapsed_ms!==undefined?e.elapsed_ms:(e.latency_ms!==undefined?e.latency_ms:e.duration_ms)||0); }, render:function(e){
				var n=e.elapsed_ms!==undefined?e.elapsed_ms:(e.latency_ms!==undefined?e.latency_ms:e.duration_ms);
				return n===null||n===undefined?'-':String(n)+' ms';
			} }
		]
	});
}

function cacheMeta(data, loaded) {
	data=data||{};
	var parts=[_('Loaded: ')+loaded];
	if(data.total!==undefined) parts.push(_('Total: ')+data.total);
	return parts.join(' · ');
}

function logRecords(data) {
	return (data && (data.records || data.entries || data.logs)) || [];
}

function logMeta(data, loaded) {
	data=data||{};
	var parts=[_('Loaded: ')+loaded];
	if(data.total!==undefined) parts.push(_('Total: ')+data.total);
	return parts.join(' · ');
}

return view.extend({
	load:function(){
		return dae.callNativeApiStatus().then(function(status){
			var hasCache=status.resources&&status.resources.dns_cache===true;
			var hasLog=status.resources&&status.resources.dns_log===true;
			return Promise.all([
				hasCache?dae.callNativeApiGet('dns_cache',{limit:200}).then(native.parse):Promise.resolve(null),
				hasLog?dae.callNativeApiGet('dns_log',{limit:200}).then(native.parse):Promise.resolve(null)
			]).then(function(v){return {status:status,cache:v[0],log:v[1]};});
		});
	},

	refresh:function(){
		var cacheFrozen=this.cacheLoader&&this.cacheLoader.frozen();
		var logFrozen=this.logLoader&&this.logLoader.frozen();

		return Promise.all([
			this.hasCache&&!cacheFrozen?dae.callNativeApiGet('dns_cache',{limit:200}).then(native.parse):Promise.resolve(null),
			this.hasLog&&!logFrozen?dae.callNativeApiGet('dns_log',{limit:200}).then(native.parse):Promise.resolve(null)
		]).then(function(v){
			if(v[0]&&v[0].ok&&this.cacheLoader) this.cacheLoader.replaceLive(v[0].data||{});
			if(v[1]&&v[1].ok&&this.logLoader) this.logLoader.replaceLive(v[1].data||{});
		}.bind(this));
	},

	render:function(data){
		var status=data.status||{};
		this.hasCache=!!(status.resources&&status.resources.dns_cache===true);
		this.hasLog=!!(status.resources&&status.resources.dns_log===true);

		var cacheNode, logNode;

		if(this.hasCache) {
			if(data.cache&&data.cache.ok) {
				var cacheInitial=data.cache.data||{};
				this.cacheGrid=cacheGrid(cacheInitial.entries||[]);
				var cacheInfo=E('div',{'id':'native-dns-cache-meta','class':'cbi-map-descr'},cacheMeta(cacheInitial,(cacheInitial.entries||[]).length));
				this.cacheLoader=native.cursorLoader('dns_cache',cacheInitial,{
					grid:this.cacheGrid,
					rowsKey:'entries',
					query:{limit:200},
					maxRows:5000,
					onData:function(page,rows){cacheInfo.textContent=cacheMeta(page,rows.length);}
				});
				cacheNode=E([], [cacheInfo,this.cacheLoader.node,this.cacheGrid.node]);
			} else {
				cacheNode=native.errorBox(data.cache);
			}
		} else {
			cacheNode=native.unavailable(status,'dns_cache');
		}

		if(this.hasLog) {
			if(data.log&&data.log.ok) {
				var logInitial=data.log.data||{};
				this.logGrid=logGrid(logRecords(logInitial));
				var logInfo=E('div',{'id':'native-dns-log-meta','class':'cbi-map-descr'},logMeta(logInitial,logRecords(logInitial).length));
				this.logLoader=native.cursorLoader('dns_log',logInitial,{
					grid:this.logGrid,
					extract:logRecords,
					query:{limit:200},
					maxRows:5000,
					onData:function(page,rows){logInfo.textContent=logMeta(page,rows.length);}
				});
				logNode=E([], [logInfo,this.logLoader.node,this.logGrid.node]);
			} else {
				logNode=native.errorBox(data.log);
			}
		} else {
			logNode=native.unavailable(status,'dns_log');
		}

		if(this.hasCache||this.hasLog) poll.add(dae.visiblePoll(L.bind(this.refresh,this)), 10);

		return E([],[
			E('h2',{},_('DNS Runtime')),
			E('div',{'class':'cbi-map-descr'},_('Read-only DNS cache and log resources. Loading another server cursor page freezes that dataset snapshot until you explicitly restart it.')),
			E('h3',{},_('DNS Cache')),
			cacheNode,
			E('h3',{},_('DNS Log')),
			logNode
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
