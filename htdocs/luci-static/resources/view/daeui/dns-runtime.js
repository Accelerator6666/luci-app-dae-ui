'use strict';
'require view';
'require poll';
'require dom';
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

function cacheMeta(data) {
	data=data||{};
	var entries=data.entries||[];
	var parts=[_('Loaded: ')+entries.length];
	if(data.total!==undefined) parts.push(_('Total: ')+data.total);
	if(data.next_cursor) parts.push(_('more server pages available'));
	return parts.join(' · ');
}

function logRecords(data) {
	return (data && (data.records || data.entries || data.logs)) || [];
}

function logMeta(data) {
	data=data||{};
	var records=logRecords(data);
	var parts=[_('Loaded: ')+records.length];
	if(data.total!==undefined) parts.push(_('Total: ')+data.total);
	if(data.next_cursor) parts.push(_('older server page available'));
	return parts.join(' · ');
}

return view.extend({
	load:function(){
		return dae.callNativeApiStatus().then(function(status){
			var hasCache=status.resources&&status.resources.dns_cache===true;
			var hasLog=status.resources&&status.resources.dns_log===true;
			return Promise.all([
				hasCache?dae.callNativeApiGet('dns_cache',{limit:1000}).then(native.parse):Promise.resolve(null),
				hasLog?dae.callNativeApiGet('dns_log',{limit:500}).then(native.parse):Promise.resolve(null)
			]).then(function(v){return {status:status,cache:v[0],log:v[1]};});
		});
	},

	refresh:function(){
		return Promise.all([
			this.hasCache?dae.callNativeApiGet('dns_cache',{limit:1000}).then(native.parse):Promise.resolve(null),
			this.hasLog?dae.callNativeApiGet('dns_log',{limit:500}).then(native.parse):Promise.resolve(null)
		]).then(function(v){
			if(this.hasCache&&v[0]&&v[0].ok){
				if(this.cacheGrid) this.cacheGrid.setRows((v[0].data&&v[0].data.entries)||[]);
				var cm=document.getElementById('native-dns-cache-meta'); if(cm) cm.textContent=cacheMeta(v[0].data);
			}
			if(this.hasLog&&v[1]&&v[1].ok){
				if(this.logGrid) this.logGrid.setRows(logRecords(v[1].data));
				var lm=document.getElementById('native-dns-log-meta'); if(lm) lm.textContent=logMeta(v[1].data);
			}
		}.bind(this));
	},

	render:function(data){
		var status=data.status||{};
		this.hasCache=!!(status.resources&&status.resources.dns_cache===true);
		this.hasLog=!!(status.resources&&status.resources.dns_log===true);

		if(this.hasCache&&data.cache&&data.cache.ok)
			this.cacheGrid=cacheGrid((data.cache.data&&data.cache.data.entries)||[]);
		if(this.hasLog&&data.log&&data.log.ok)
			this.logGrid=logGrid(logRecords(data.log.data));

		if(this.hasCache||this.hasLog) poll.add(L.bind(this.refresh,this),10);

		return E([],[
			E('h2',{},_('DNS Runtime')),
			E('div',{'class':'cbi-map-descr'},_('Read-only DNS cache and log resources. Search, filters, sorting and local paging operate on the current backend page; no cache mutation or DNS query action is sent.')),

			E('h3',{},_('DNS Cache')),
			this.hasCache
				? (data.cache&&data.cache.ok
					? E([],[
						E('div',{'id':'native-dns-cache-meta','class':'cbi-map-descr'},cacheMeta(data.cache.data)),
						data.cache.data&&data.cache.data.next_cursor?E('div',{'class':'alert-message notice'},_('The cache has another server cursor page beyond the current 1000-entry snapshot.')):null,
						E('div',{'id':'native-dns-cache'},this.cacheGrid.node)
					])
					: native.errorBox(data.cache))
				: native.unavailable(status,'dns_cache'),

			E('h3',{},_('DNS Log')),
			this.hasLog
				? (data.log&&data.log.ok
					? E([],[
						E('div',{'id':'native-dns-log-meta','class':'cbi-map-descr'},logMeta(data.log.data)),
						data.log.data&&data.log.data.next_cursor?E('div',{'class':'alert-message notice'},_('Older DNS log records remain on another server cursor page.')):null,
						E('div',{'id':'native-dns-log'},this.logGrid.node)
					])
					: native.errorBox(data.log))
				: native.unavailable(status,'dns_log')
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
