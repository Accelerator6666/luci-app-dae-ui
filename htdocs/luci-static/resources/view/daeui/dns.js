'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';
'require daeui.cards as cards';

function quick(id){
	return E('div',{'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0'},[
		E('button',{'class':'btn cbi-button','click':function(){
			var ta=document.getElementById(id); if(!ta||(ta.value||'').trim()) return;
			ta.value="upstream {\n    local_dns: 'udp://223.5.5.5:53'\n    remote_dns: 'https://dns.google/dns-query'\n}\nrouting {\n    request {\n        qname(geosite:cn) -> local_dns\n        fallback: remote_dns\n    }\n}\n";
		}},_('Insert split-DNS template'))
	]);
}

function upstreamCards(all){
	var items=[];
	((all&&all.sections)||[]).filter(function(s){return s.name==='dns';}).forEach(function(sec){
		cards.dnsUpstreams(sec.content).forEach(function(x){x.source=sec.source;items.push(x);});
	});
	return items.length ? E('div',{},items.map(function(x){
		return cards.card(x.name||_('DNS upstream'), x.source, E('code',{},x.value));
	})) : E('div',{'class':'alert-message notice'},_('No DNS upstream entries could be summarized.'));
}

return view.extend({
	load:function(){return Promise.all([dae.callGetSections(),dae.callGetManagedSection('dns')]);},
	render:function(data){
		return E([],[
			E('h2',{},_('DNS')),
			E('div',{'class':'cbi-map-descr'},_('Upstream cards summarize common DNS entries. Nested request/response routing remains visible in the full source blocks.')),
			managed.includeBanner(data[1]),
			E('h3',{},_('DNS upstreams')),
			upstreamCards(data[0]),
			E('h3',{},_('Source configuration')),
			managed.existingSections(data[0],['dns']),
			managed.editor('dns',data[1],_('Edit upstream, request routing and response routing within this managed DNS section.'),quick)
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
