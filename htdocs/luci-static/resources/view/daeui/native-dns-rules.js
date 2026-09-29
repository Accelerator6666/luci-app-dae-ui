'use strict';
'require view';
'require daeui.common as dae';
'require daeui.native as native';

function sourceMap(configData) {
	var out={};
	((configData&&configData.sources)||[]).forEach(function(s){
		if(s&&s.id) out[s.id]=s;
	});
	return out;
}

function localSet(filesData) {
	var out={};
	((filesData&&filesData.files)||[]).forEach(function(f){
		if(f&&f.path) out[f.path]=true;
	});
	return out;
}

function sourceText(rule,sources) {
	var src=rule&&rule.source;
	if(!src) return '-';
	var cfg=sources[src.source_id]||{};
	var path=cfg.path||src.file||'';
	var pos=src.line?':'+src.line+(src.column?':'+src.column:''):'';
	return (path||src.source_id||'-')+pos;
}

function sourceNode(rule,sources,locals) {
	var src=rule&&rule.source;
	if(!src) return '-';

	var cfg=sources[src.source_id]||null;
	var path=cfg&&cfg.path?cfg.path:'';
	var label=sourceText(rule,sources);

	if(path&&locals[path])
		return E('a',{'href':dae.configUrl(path,src.line||0)},E('code',{},label));

	return E('span',{},[
		E('code',{},label),
		E('span',{'class':'cbi-map-descr'},cfg?' · '+_('not a locally discovered source'):' · '+_('source_id not mapped by Native config'))
	]);
}

function target(rule) {
	if(!rule) return '-';
	if(rule.action==='upstream'||rule.action==='requery')
		return rule.upstream||'-';
	return rule.action||'-';
}

function gridFor(rows,list,sources,locals) {
	return native.dataGrid(rows,{
		searchPlaceholder:_('Search expression, action, upstream, rule ID or source…'),
		pageSize:50,
		defaultSort:'index',
		filters:[
			{key:'kind',title:_('kind'),value:function(r){return native.text(r.kind,'');}},
			{key:'action',title:_('action'),value:function(r){return native.text(r.action,'');}},
			{key:'upstream',title:_('upstream'),value:function(r){return native.text(r.upstream,'');}}
		],
		search:function(r){
			return [r.rule_id,r.expression,r.action,r.upstream,sourceText(r,sources),list].join(' ');
		},
		columns:[
			{key:'index',title:_('Index'),numeric:true,value:function(r){return Number(r.index||0);}},
			{key:'kind',title:_('Kind'),value:function(r){return native.text(r.kind,'');}},
			{key:'expression',title:_('Expression'),value:function(r){return native.text(r.expression,'');},render:function(r){return E('code',{},native.text(r.expression));}},
			{key:'action',title:_('Action'),value:function(r){return native.text(r.action,'');}},
			{key:'upstream',title:_('Upstream / result'),value:target},
			{key:'rule_id',title:_('Rule ID'),value:function(r){return native.text(r.rule_id,'');},render:function(r){return E('code',{},native.text(r.rule_id));}},
			{key:'source',title:_('Source'),value:function(r){return sourceText(r,sources);},render:function(r){return sourceNode(r,sources,locals);}}
		]
	});
}

function findRule(data,list,ruleId) {
	var rows=(data&&data[list])||[];
	for(var i=0;i<rows.length;i++)
		if(rows[i].rule_id===ruleId) return rows[i];
	return null;
}

function resolvedNode(data,list,ruleId,generation,sources,locals) {
	if(!ruleId) return null;
	if(generation&&String(data.generation_id||'')!==generation)
		return E('div',{'class':'alert-message warning'},[
			_('The requested DNS route evidence belongs to generation '),E('code',{},generation),
			_(', but this page currently exposes generation '),E('code',{},native.text(data.generation_id)),
			_('. No cross-generation DNS rule association is made.')
		]);

	if(list!=='request'&&list!=='response')
		return E('div',{'class':'alert-message warning'},_('The requested DNS rule list is invalid.'));

	var rule=findRule(data,list,ruleId);
	if(!rule)
		return E('div',{'class':'alert-message warning'},[
			_('Generation matches, but DNS rule ID '),E('code',{},ruleId),
			_(' is not present in the requested dictionary list.')
		]);

	return E('div',{'class':'cbi-section'},[
		E('h3',{},_('Resolved DNS rule')),
		E('div',{'class':'alert-message success'},_('This DNS rule was opened with generation-qualified retained route evidence.')),
		E('div',{'class':'table'},[
			E('div',{'class':'tr'},[
				E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('List')),
				E('div',{'class':'td left'},list)
			]),
			E('div',{'class':'tr'},[
				E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Rule ID')),
				E('div',{'class':'td left'},E('code',{},native.text(rule.rule_id)))
			]),
			E('div',{'class':'tr'},[
				E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Expression')),
				E('div',{'class':'td left'},E('code',{},native.text(rule.expression)))
			]),
			E('div',{'class':'tr'},[
				E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Action')),
				E('div',{'class':'td left'},native.text(rule.action))
			]),
			E('div',{'class':'tr'},[
				E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Upstream')),
				E('div',{'class':'td left'},native.text(rule.upstream))
			]),
			E('div',{'class':'tr'},[
				E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Source')),
				E('div',{'class':'td left'},sourceNode(rule,sources,locals))
			])
		])
	]);
}

return view.extend({
	load:function(){
		return dae.callNativeApiStatus().then(function(status){
			if(!status.resources||status.resources.dns_rules!==true)
				return {status:status,rules:null,config:null,files:null};

			return Promise.all([
				dae.callNativeApiGet('dns_rules').then(native.parse),
				status.resources.config===true?dae.callNativeApiGet('config').then(native.parse):Promise.resolve(null),
				dae.callListConfigFiles()
			]).then(function(v){
				return {status:status,rules:v[0],config:v[1],files:v[2]};
			});
		});
	},

	render:function(data){
		var status=data.status||{};
		if(!(status.resources&&status.resources.dns_rules===true))
			return E([],[
				E('h2',{},_('Native DNS Rules')),
				native.unavailable(status,'dns_rules')
			]);

		if(!data.rules||!data.rules.ok)
			return E([],[
				E('h2',{},_('Native DNS Rules')),
				native.errorBox(data.rules)
			]);

		var rulesData=data.rules.data||{};
		var configData=data.config&&data.config.ok?data.config.data:{};
		var sources=sourceMap(configData);
		var locals=localSet(data.files||{});
		var requestRows=(rulesData.request||[]).slice();
		var responseRows=(rulesData.response||[]).slice();
		var requestGrid=gridFor(requestRows,'request',sources,locals);
		var responseGrid=gridFor(responseRows,'response',sources,locals);

		var params=new URLSearchParams(window.location.search||'');
		var requestedRule=params.get('rule')||'';
		var requestedList=params.get('list')||'';
		var requestedGeneration=params.get('generation')||'';
		var selected=resolvedNode(rulesData,requestedList,requestedRule,requestedGeneration,sources,locals);

		return E([],[
			E('h2',{},_('Native DNS Rule Dictionary')),
			E('div',{'class':'cbi-map-descr'},_('Read-only DNS request and response routing rules for one running generation. Request rules select upstream/asis/reject; response rules select accept/reject/requery. Source links use source_id → Native config source → exact local .dae path matching.')),
			E('div',{'class':'alert-message notice'},[
				_('Generation: '),E('code',{},native.text(rulesData.generation_id)),
				' · ',_('Request rules: '),String(requestRows.length),
				' · ',_('Response rules: '),String(responseRows.length)
			]),
			selected,
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Request rules')),
				E('div',{'class':'cbi-map-descr'},_('Evaluation order; the final entry is the request fallback reported by the backend.')),
				requestGrid.node
			]),
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Response rules')),
				E('div',{'class':'cbi-map-descr'},_('Evaluation order; the final entry is the response fallback reported by the backend.')),
				responseGrid.node
			])
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
