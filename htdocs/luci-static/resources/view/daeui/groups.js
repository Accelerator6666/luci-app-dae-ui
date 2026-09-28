'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';
'require daeui.cards as cards';

function quick(id) {
	var name=E('input',{'class':'cbi-input-text','placeholder':_('group name')});
	var policy=E('select',{'class':'cbi-input-select'},['min','min_moving_avg','random','fixed'].map(function(p){return E('option',{'value':p},p);}));
	var filter=E('input',{'class':'cbi-input-text','placeholder':"subtag('my_sub')",'style':'min-width:280px;flex:1'});
	return E('div',{'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0'},[
		name,policy,filter,
		E('button',{'class':'btn cbi-button','click':function(){
			var n=(name.value||'').trim(),f=(filter.value||'').trim(); if(!n) return;
			var text=n+' {\n'; if(f) text+='    filter: '+f+'\n'; text+='    policy: '+policy.value+'\n}';
			managed.appendLine(id,text); name.value=''; filter.value='';
		}},_('Stage policy group'))
	]);
}

function renderCards(all){
	var items=[];
	((all&&all.sections)||[]).filter(function(s){return s.name==='group';}).forEach(function(sec){
		cards.groupCards(sec.content).forEach(function(g){g.source=sec.source;items.push(g);});
	});
	return items.length ? E('div',{},items.map(function(g){
		return cards.card(g.name, _('Policy: ')+g.policy+' · '+g.source, E('code',{},g.filter));
	})) : E('div',{'class':'alert-message notice'},_('No policy groups could be summarized.'));
}

return view.extend({
	load:function(){return Promise.all([dae.callGetSections(),dae.callGetManagedSection('groups')]);},
	render:function(data){
		return E([],[
			E('h2',{},_('Policy Groups')),
			E('div',{'class':'cbi-map-descr'},_('Policy cards summarize common group syntax. Existing groups remain user-owned and are never rewritten by the quick editor.')),
			managed.includeBanner(data[1]),
			E('h3',{},_('Policy cards')),
			renderCards(data[0]),
			E('h3',{},_('Source configuration')),
			managed.existingSections(data[0],['group']),
			managed.editor('groups',data[1],_('The quick form creates a simple group. Advanced filters and policies can be edited directly before applying.'),quick)
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
