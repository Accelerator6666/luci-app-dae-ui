'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';
'require daeui.cards as cards';

function quick(id){
	var cond=E('input',{'class':'cbi-input-text','placeholder':'domain(geosite:cn)','style':'min-width:300px;flex:1'});
	var out=E('input',{'class':'cbi-input-text','placeholder':'direct / proxy / block','style':'min-width:180px'});
	return E('div',{'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0'},[
		cond,out,
		E('button',{'class':'btn cbi-button','click':function(){
			var c=(cond.value||'').trim(),o=(out.value||'').trim(); if(!c||!o) return;
			managed.appendLine(id,c+' -> '+o); cond.value='';
		}},_('Stage rule'))
	]);
}

function table(all){
	var rows=[];
	((all&&all.sections)||[]).filter(function(s){return s.name==='routing';}).forEach(function(sec){
		cards.routingRows(sec.content).forEach(function(r){r.source=sec.source;rows.push(r);});
	});
	return rows.length ? E('table',{'class':'table cbi-section-table'},[
		E('tr',{'class':'tr table-titles'},[
			E('th',{'class':'th'},_('Match')),
			E('th',{'class':'th'},_('Outbound')),
			E('th',{'class':'th'},_('Source'))
		]),
		rows.map(function(r){return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},E('code',{},r.match)),
			E('td',{'class':'td'},E('strong',{},r.outbound)),
			E('td',{'class':'td'},E('code',{},r.source||'-'))
		]);})
	]) : E('div',{'class':'alert-message notice'},_('No routing rules could be summarized.'));
}

return view.extend({
	load:function(){return Promise.all([dae.callGetSections(),dae.callGetManagedSection('routing')]);},
	render:function(data){
		return E([],[
			E('h2',{},_('Routing')),
			E('div',{'class':'cbi-map-descr'},_('The table summarizes one-line rules in evaluation order. Complex multiline rules remain visible in Source configuration.')),
			managed.includeBanner(data[1]),
			E('h3',{},_('Routing table')),
			table(data[0]),
			E('h3',{},_('Source configuration')),
			managed.existingSections(data[0],['routing']),
			managed.editor('routing',data[1],_('Add rules in normal dae syntax. Rule order inside this managed section is preserved.'),quick)
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
