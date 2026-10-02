'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';
'require daeui.cards as cards';
'require daeui.native as native';

function nodeQuick(id) {
	var tag = E('input', { 'class':'cbi-input-text','placeholder':_('optional tag'),'style':'min-width:140px' });
	var url = E('input', { 'class':'cbi-input-text','placeholder':'vless://… / ss://… / socks5://…','style':'min-width:360px;flex:1' });
	return E('div', { 'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0' }, [
		tag, url,
		E('button', { 'class':'btn cbi-button','click':function() {
			var u=(url.value||'').trim(); if(!u) return;
			var t=(tag.value||'').trim();
			managed.appendLine(id,(t ? t+': ' : '')+"'" + u.replace(/'/g,"\\'") + "'");
			url.value='';
		}}, _('Stage node'))
	]);
}

function subQuick(id) {
	var tag = E('input', { 'class':'cbi-input-text','placeholder':_('subscription tag'),'style':'min-width:160px' });
	var url = E('input', { 'class':'cbi-input-text','placeholder':'https://…','style':'min-width:360px;flex:1' });
	return E('div', { 'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0' }, [
		tag,url,
		E('button', { 'class':'btn cbi-button','click':function() {
			var t=(tag.value||'').trim(),u=(url.value||'').trim(); if(!t||!u) return;
			managed.appendLine(id,t+": '"+u.replace(/'/g,"\\'")+"'");
			url.value='';
		}}, _('Stage subscription'))
	]);
}

function bestLatency(node, transport) {
	var best=null;
	((node&&node.health)||[]).forEach(function(h){
		if(h.transport!==transport || h.latency_ms===null || h.latency_ms===undefined) return;
		var n=Number(h.latency_ms);
		if(Number.isFinite(n) && (best===null || n<best)) best=n;
	});
	return best;
}

function exactRuntimeNode(name, runtimeNodes) {
	if(!name) return null;
	var matches=(runtimeNodes||[]).filter(function(n){
		return String(n.name||'')===name || String(n.id||'')===name;
	});
	return matches.length===1 ? matches[0] : null;
}

function nodeRuntimeMeta(node) {
	if(!node) return null;
	var tcp=bestLatency(node,'tcp'), udp=bestLatency(node,'udp');
	var parts=[];
	if(tcp!==null) parts.push('TCP '+tcp.toFixed(0)+' ms');
	if(udp!==null) parts.push('UDP '+udp.toFixed(0)+' ms');
	if(Array.isArray(node.group_ids)&&node.group_ids.length) parts.push(_('groups')+': '+node.group_ids.join(', '));
	return parts.length ? parts.join(' · ') : _('Runtime node found; no latency observation reported');
}

function subscriptionRuntime(name, runtimeNodes) {
	if(!name) return [];
	return (runtimeNodes||[]).filter(function(n){
		return String(n.subscription_tag||'')===name || String(n.provider_id||'')===name;
	});
}

function subscriptionRuntimeNode(name, runtimeNodes) {
	var members=subscriptionRuntime(name,runtimeNodes);
	if(!members.length) return null;
	var tcp=[];
	members.forEach(function(n){
		var v=bestLatency(n,'tcp');
		if(v!==null) tcp.push(v);
	});
	var summary=[members.length+' '+_('runtime node(s)')];
	if(tcp.length) summary.push(_('best TCP')+' '+Math.min.apply(Math,tcp).toFixed(0)+' ms');
	return E('div',{},[
		E('div',{'class':'cbi-map-descr','style':'margin-top:6px'},summary.join(' · ')),
		E('details',{'style':'margin-top:6px'},[
			E('summary',{},_('Runtime members')),
			E('div',{'style':'max-height:180px;overflow:auto;margin-top:6px'},members.slice(0,50).map(function(n){
				var t=bestLatency(n,'tcp'),u=bestLatency(n,'udp');
				var m=[];
				if(t!==null) m.push('TCP '+t.toFixed(0)+' ms');
				if(u!==null) m.push('UDP '+u.toFixed(0)+' ms');
				return E('div',{'style':'margin:3px 0'},[
					E('code',{},native.text(n.name||n.id)),
					m.length ? ' · '+m.join(' · ') : ''
				]);
			}))
		])
	]);
}

function renderNodeCards(all, runtimeData) {
	var ns=[], ss=[];
	var runtimeNodes=(runtimeData&&runtimeData.nodes)||[];
	((all&&all.sections)||[]).forEach(function(sec){
		if(sec.name==='node') cards.nodeCards(sec.content).forEach(function(x){ x.source=sec.source; ns.push(x); });
		if(sec.name==='subscription') cards.subscriptionCards(sec.content).forEach(function(x){ x.source=sec.source; ss.push(x); });
	});
	return E([],[
		E('h3',{},_('Node cards')),
		ns.length ? E('div',{},ns.map(function(n){
			var rt=exactRuntimeNode(n.name,runtimeNodes);
			return cards.card(
				n.name || n.protocol,
				n.protocol + ' · ' + n.source,
				E('div',{},[
					E('code',{},n.value),
					rt ? E('div',{'class':'cbi-map-descr','style':'margin-top:6px'},nodeRuntimeMeta(rt)) : null
				])
			);
		})) : E('div',{'class':'alert-message notice'},_('No node entries could be summarized.')),
		E('h3',{},_('Subscription cards')),
		ss.length ? E('div',{},ss.map(function(s){
			return cards.card(
				s.name || _('Subscription'),
				s.source,
				E('div',{},[
					E('code',{},s.value),
					subscriptionRuntimeNode(s.name,runtimeNodes)
				])
			);
		})) : E('div',{'class':'alert-message notice'},_('No subscription entries could be summarized.'))
	]);
}

return view.extend({
	load:function(){
		return Promise.all([
			dae.callGetSections(),
			dae.callGetManagedSection('nodes'),
			dae.callGetManagedSection('subscriptions'),
			dae.callNativeApiStatus().then(function(status){
				if(!(status&&status.resources&&status.resources.nodes===true))
					return {status:status||{},resource:null};
				return dae.callNativeApiGet('nodes',{limit:1000}).then(function(res){
					return {status:status,resource:native.parse(res)};
				});
			}).catch(function(){return {status:{},resource:null};})
		]);
	},
	render:function(data){
		var runtime=data[3]||{};
		var runtimeData=runtime.resource&&runtime.resource.ok ? (runtime.resource.data||{}) : {};
		var partial=!!runtimeData.next_cursor;
		return E([],[
			E('h2',{},_('Nodes & Subscriptions')),
			E('div',{'class':'cbi-map-descr'},_('Existing definitions remain untouched. Cards are a best-effort summary of standard one-line entries; advanced syntax is still preserved in the source view.')),
			runtime.resource&&runtime.resource.ok
				? E('div',{'class':'alert-message success'},[
					_('Native runtime correlation enabled. Exact tagged nodes and subscription/provider tags are joined to the current runtime inventory.'),
					partial ? ' '+_('The runtime inventory has additional server pages, so this card summary is partial.') : ''
				])
				: E('div',{'class':'alert-message notice'},_('Native runtime node data is unavailable; source cards remain fully usable without it.')),
			managed.includeBanner(data[1]),
			renderNodeCards(data[0],runtimeData),
			E('h3',{},_('Source configuration')),
			managed.existingSections(data[0],['node','subscription']),
			managed.editor('nodes',data[1],_('Use one DAE node entry per line.'),nodeQuick),
			managed.editor('subscriptions',data[2],_('Use one tagged DAE subscription entry per line.'),subQuick)
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
