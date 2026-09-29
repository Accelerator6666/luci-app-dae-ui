'use strict';
'require view';
'require poll';
'require ui';
'require daeui.common as dae';
'require daeui.native as native';
'require daeui.flowtrace as flowtrace';

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

function buildGrid(rows, canResolveRule, resolver, detailHandler) {
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
			{ key:'time', title:_('Time'), value:function(f){ return f.started_at || f.observed_at || ''; }, render:function(f){ return native.time(f.started_at || f.observed_at); } },
			{ key:'trace', title:_('Trace'), sortable:false, value:function(){return '';}, render:function(f) {
				return E('button',{
					'class':'btn cbi-button cbi-button-action',
					'click':function(){return detailHandler(f);}
				},_('Timeline'));
			} }
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

	loadFlowContext:function(flow) {
		var tasks=[
			dae.callNativeFlowGet(String(flow.id)).then(native.parse),
			this.canResolveRule ? dae.callNativeApiGet('rules').then(native.parse) : Promise.resolve(null),
			this.canResolveDnsRule ? dae.callNativeApiGet('dns_rules').then(native.parse) : Promise.resolve(null)
		];

		return Promise.all(tasks).then(function(v){
			return {
				detail:v[0],
				rules:v[1]&&v[1].ok?v[1].data:null,
				rulesError:v[1]&&!v[1].ok?v[1]:null,
				dnsRules:v[2]&&v[2].ok?v[2].data:null,
				dnsRulesError:v[2]&&!v[2].ok?v[2]:null
			};
		});
	},

	viewFlow:function(flow) {
		if(!flow||!flow.id) return;
		ui.showModal(_('Flow trace'),[
			E('p',{'class':'spinning'},_('Loading retained flow detail…'))
		]);

		return this.loadFlowContext(flow).then(function(ctx){
			if(!ctx.detail.ok) {
				ui.showModal(_('Flow trace'),[
					native.errorBox(ctx.detail),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}

			var detail=ctx.detail.data||{};
			var body=E('div',{'style':'max-height:72vh;overflow:auto;padding-right:6px'},[
				flowtrace.summaryNode(detail,{traffic:ctx.rules,dns:ctx.dnsRules}),
				ctx.rulesError?E('div',{'class':'alert-message notice'},[
					_('The flow trace is available, but the current traffic rule dictionary could not be loaded: '),
					ctx.rulesError.error
				]):null,
				ctx.dnsRulesError?E('div',{'class':'alert-message notice'},[
					_('The flow trace is available, but the current DNS rule dictionary could not be loaded: '),
					ctx.dnsRulesError.error
				]):null,
				E('h3',{},_('Retained trace timeline')),
				E('div',{'class':'cbi-map-descr'},_('Steps are ordered by seq. Generation IDs belong to the recorded evidence. traffic and dns_upstream steps use the traffic rule dictionary; dns_request and dns_response use the DNS rule dictionary. Links appear only on an exact generation match.')),
				flowtrace.traceNode(detail,{traffic:ctx.rules,dns:ctx.dnsRules}),
				E('details',{'style':'margin-top:12px'},[
					E('summary',{},_('Raw flow detail')),
					E('pre',{'style':'white-space:pre-wrap;max-height:420px;overflow:auto'},JSON.stringify(detail,null,2))
				])
			]);

			ui.showModal(_('Flow trace · ')+native.text(detail.id),[
				body,
				E('div',{'class':'right','style':'margin-top:12px'},[
					E('button',{'class':'btn','click':ui.hideModal},_('Close'))
				])
			]);
		});
	},

	resolveRule:function(flow) {
		if(!flow||!flow.id||!flow.rule_id) return;
		ui.showModal(_('Resolve flow rule'),[
			E('p',{'class':'spinning'},_('Reading retained flow evidence and current rule dictionary…'))
		]);

		return this.loadFlowContext(flow).then(function(ctx){
			if(!ctx.detail.ok) {
				ui.showModal(_('Resolve flow rule'),[
					native.errorBox(ctx.detail),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}
			if(!ctx.rules) {
				ui.showModal(_('Resolve flow rule'),[
					native.errorBox(ctx.rulesError||{error:_('Current rule dictionary is unavailable.')}),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}

			var detail=ctx.detail.data||{};
			var evidence=flowtrace.trafficRuleEvidence(detail,String(flow.rule_id));
			if(!evidence) {
				ui.showModal(_('Resolve flow rule'),[
					E('div',{'class':'alert-message notice'},_('No retained traffic-route step proves the generation for this flow rule. The summary rule_id is therefore not joined to the current dictionary.')),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}

			var flowGeneration=String(evidence.generation_id||'');
			var rulesGeneration=String(ctx.rules.generation_id||'');
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

			var rule=flowtrace.findRule(ctx.rules,String(flow.rule_id));
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
		this.canResolveRule=!!(status.resources&&status.resources.rules===true);
		this.canResolveDnsRule=!!(status.resources&&status.resources.dns_rules===true);

		if(!available)
			return E([], [ E('h2',{},_('Native Flows')), native.unavailable(status,'flows') ]);

		if(!data.resource||!data.resource.ok)
			return E([], [ E('h2',{},_('Native Flows')), native.errorBox(data.resource) ]);

		var initial=data.resource.data||{};
		this.grid=buildGrid(initial.flows||[],this.canResolveRule,this.resolveRule.bind(this),this.viewFlow.bind(this));
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
			E('div',{'class':'cbi-map-descr'},_('Read-only retained flow summaries. Timeline opens the recorded causal trace. Traffic and DNS rule links are generation-safe and never join historical evidence to a different current routing generation.')),
			info,
			this.loader.node,
			this.grid.node
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
