'use strict';
'require view';
'require poll';
'require ui';
'require daeui.common as dae';
'require daeui.native as native';

function network(f) {
	return f.network || (f.input && f.input.network) || f.transport || '-';
}

function source(f) {
	return f.src || (f.input && f.input.src) || '-';
}

function target(f) {
	return f.domain || f.dst || f.destination ||
		(f.input && (f.input.domain || f.input.dst || f.input.destination)) || '-';
}

function outbound(f) {
	return f.outbound || f.final_outbound || '-';
}

function buildGrid(rows, canResolveRule, resolver) {
	return native.dataGrid(rows, {
		searchPlaceholder: _('Search flow, source, target, outbound, rule or connection…'),
		pageSize: 50,
		filters: [
			{ key:'network', title:_('network'), value:network },
			{ key:'state', title:_('state'), value:function(f){ return native.text(f.state || f.status, ''); } },
			{ key:'outbound', title:_('outbound'), value:outbound }
		],
		search: function(f) {
			return [
				f.id, f.connection_id, network(f), source(f), target(f), outbound(f),
				f.state, f.status, f.rule_id, f.rule_expression
			].join(' ');
		},
		columns: [
			{ key:'id', title:_('Flow ID'), value:function(f){ return native.text(f.id, ''); }, render:function(f){ return E('code',{},native.text(f.id)); } },
			{ key:'network', title:_('Network'), value:network },
			{ key:'state', title:_('State'), value:function(f){ return native.text(f.state || f.status, ''); } },
			{ key:'source', title:_('Source'), value:source, render:function(f){ return E('code',{},native.text(source(f))); } },
			{ key:'target', title:_('Target'), value:target, render:function(f){ return E('code',{},native.text(target(f))); } },
			{ key:'outbound', title:_('Outbound'), value:outbound },
			{ key:'rule', title:_('Rule'), sortable:false, value:function(f){ return native.text(f.rule_id, ''); }, render:function(f) {
				if (!f.rule_id) return '-';
				if (!canResolveRule) return E('code',{},native.text(f.rule_id));
				return E('button',{
					'class':'btn-link',
					'click':function(){return resolver(f);}
				},native.text(f.rule_id));
			} },
			{ key:'connection', title:_('Connection'), value:function(f){ return native.text(f.connection_id, ''); } },
			{ key:'time', title:_('Time'), value:function(f){ return f.started_at || f.observed_at || ''; }, render:function(f){ return native.time(f.started_at || f.observed_at); } }
		]
	});
}

function meta(data, loaded) {
	data = data || {};
	var parts = [ _('Loaded: ') + loaded ];
	if (data.total !== undefined) parts.push(_('Total: ') + data.total);
	if (data.dropped_records !== undefined) parts.push(_('Dropped records: ') + data.dropped_records);
	return parts.join(' · ');
}

function trafficRuleEvidence(detail, ruleId) {
	var matches=((detail&&detail.trace&&detail.trace.steps)||[]).filter(function(step){
		return step && step.stage==='route' && step.data && step.data.chain==='traffic' &&
			step.data.rule_id===ruleId && step.generation_id;
	}).sort(function(a,b){return Number(a.seq||0)-Number(b.seq||0);});
	return matches.length?matches[matches.length-1]:null;
}

function findRule(rules, ruleId) {
	var rows=(rules&&rules.rules)||[];
	for(var i=0;i<rows.length;i++) if(rows[i].rule_id===ruleId) return rows[i];
	if(rules&&rules.fallback&&rules.fallback.rule_id===ruleId) return rules.fallback;
	return null;
}

return view.extend({
	load:function(){
		return native.loadResource('flows', { limit:200 });
	},

	refresh:function(){
		if (this.loader && this.loader.frozen()) return Promise.resolve();
		return dae.callNativeApiGet('flows', { limit:200 }).then(function(res){
			var parsed=native.parse(res);
			if(parsed.ok && this.loader) this.loader.replaceLive(parsed.data || {});
		}.bind(this));
	},

	resolveRule:function(flow) {
		if(!flow||!flow.id||!flow.rule_id) return;
		ui.showModal(_('Resolve flow rule'),[
			E('p',{'class':'spinning'},_('Reading retained flow evidence and current rule dictionary…'))
		]);

		return Promise.all([
			dae.callNativeFlowGet(String(flow.id)).then(native.parse),
			dae.callNativeApiGet('rules').then(native.parse)
		]).then(function(v){
			var detail=v[0], rules=v[1];
			if(!detail.ok||!rules.ok) {
				ui.showModal(_('Resolve flow rule'),[
					native.errorBox(!detail.ok?detail:rules),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}

			var evidence=trafficRuleEvidence(detail.data||{},String(flow.rule_id));
			if(!evidence) {
				ui.showModal(_('Resolve flow rule'),[
					E('div',{'class':'alert-message notice'},_('No retained traffic-route step proves the generation for this flow rule. The summary rule_id is therefore not joined to the current dictionary.')),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}

			var rulesData=rules.data||{};
			var flowGeneration=String(evidence.generation_id||'');
			var rulesGeneration=String(rulesData.generation_id||'');
			if(!flowGeneration||flowGeneration!==rulesGeneration) {
				ui.showModal(_('Resolve flow rule'),[
					E('div',{'class':'alert-message warning'},_('Generation mismatch. This retained flow must not be joined to the current rule dictionary.')),
					E('div',{'class':'table'},[
						E('div',{'class':'tr'},[
							E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Flow route generation')),
							E('div',{'class':'td left'},E('code',{},flowGeneration||'-'))
						]),
						E('div',{'class':'tr'},[
							E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Current rules generation')),
							E('div',{'class':'td left'},E('code',{},rulesGeneration||'-'))
						])
					]),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}

			var rule=findRule(rulesData,String(flow.rule_id));
			if(!rule) {
				ui.showModal(_('Resolve flow rule'),[
					E('div',{'class':'alert-message warning'},_('The generation matches, but this rule ID is not present in the complete current dictionary.')),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}

			var href=L.url('admin/services/dae-ui/native-rules')+
				'?rule='+encodeURIComponent(String(rule.rule_id))+
				'&generation='+encodeURIComponent(flowGeneration);

			ui.showModal(_('Resolved flow rule'),[
				E('div',{'class':'alert-message success'},_('The retained traffic-route evidence and the current rule dictionary share the same generation.')),
				E('div',{'class':'table'},[
					E('div',{'class':'tr'},[
						E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Generation')),
						E('div',{'class':'td left'},E('code',{},flowGeneration))
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
						E('div',{'class':'td left','style':'width:180px;font-weight:600'},_('Outbound')),
						E('div',{'class':'td left'},native.text(rule.outbound))
					])
				]),
				E('div',{'class':'right'},[
					E('button',{'class':'btn','click':ui.hideModal},_('Close')),
					' ',
					E('a',{'class':'btn cbi-button cbi-button-action','href':href},_('Open matching rule'))
				])
			]);
		});
	},

	render:function(data){
		var status=data.status||{};
		var available=status.resources&&status.resources.flows===true;
		var canResolveRule=!!(status.resources&&status.resources.rules===true);

		if(!available)
			return E([], [ E('h2',{},_('Native Flows')), native.unavailable(status,'flows') ]);

		if(!data.resource||!data.resource.ok)
			return E([], [ E('h2',{},_('Native Flows')), native.errorBox(data.resource) ]);

		var initial=data.resource.data||{};
		this.grid=buildGrid(initial.flows||[],canResolveRule,this.resolveRule.bind(this));
		var info=E('div',{'id':'native-flows-meta','class':'cbi-map-descr'},meta(initial,(initial.flows||[]).length));
		this.loader=native.cursorLoader('flows',initial,{
			grid:this.grid,
			rowsKey:'flows',
			query:{limit:200},
			maxRows:5000,
			onData:function(page,rows){info.textContent=meta(page,rows.length);}
		});

		poll.add(L.bind(this.refresh,this),5);

		return E([],[
			E('h2',{},_('Native Flows')),
			E('div',{'class':'cbi-map-descr'},_('Read-only retained flow summaries. A rule link is resolved only after the retained flow detail proves the traffic-route generation and that generation exactly matches the current rule dictionary.')),
			info,
			this.loader.node,
			this.grid.node
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
