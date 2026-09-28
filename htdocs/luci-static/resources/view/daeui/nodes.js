'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';
'require daeui.cards as cards';

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

function renderNodeCards(all) {
	var ns=[], ss=[];
	((all&&all.sections)||[]).forEach(function(sec){
		if(sec.name==='node') cards.nodeCards(sec.content).forEach(function(x){ x.source=sec.source; ns.push(x); });
		if(sec.name==='subscription') cards.subscriptionCards(sec.content).forEach(function(x){ x.source=sec.source; ss.push(x); });
	});
	return E([],[
		E('h3',{},_('Node cards')),
		ns.length ? E('div',{},ns.map(function(n){
			return cards.card(n.name || n.protocol, n.protocol + ' · ' + n.source, E('code',{},n.value));
		})) : E('div',{'class':'alert-message notice'},_('No node entries could be summarized.')),
		E('h3',{},_('Subscription cards')),
		ss.length ? E('div',{},ss.map(function(s){
			return cards.card(s.name || _('Subscription'), s.source, E('code',{},s.value));
		})) : E('div',{'class':'alert-message notice'},_('No subscription entries could be summarized.'))
	]);
}

return view.extend({
	load:function(){ return Promise.all([dae.callGetSections(),dae.callGetManagedSection('nodes'),dae.callGetManagedSection('subscriptions')]); },
	render:function(data){
		return E([],[
			E('h2',{},_('Nodes & Subscriptions')),
			E('div',{'class':'cbi-map-descr'},_('Existing definitions remain untouched. Cards are a best-effort summary of standard one-line entries; advanced syntax is still preserved in the source view.')),
			managed.includeBanner(data[1]),
			renderNodeCards(data[0]),
			E('h3',{},_('Source configuration')),
			managed.existingSections(data[0],['node','subscription']),
			managed.editor('nodes',data[1],_('Use one DAE node entry per line.'),nodeQuick),
			managed.editor('subscriptions',data[2],_('Use one tagged DAE subscription entry per line.'),subQuick)
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
