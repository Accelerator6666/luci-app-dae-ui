'use strict';
'require view';
'require daeui.common as dae';
'require daeui.native as native';
'require daeui.flowtrace as flowtrace';

function flowIdFromLocation() {
	var params=new URLSearchParams(window.location.search||'');
	return params.get('id')||'';
}

function flowContext(id) {
	if(!id) return Promise.resolve({id:'',status:{},detail:null,rules:null,dnsRules:null});
	return dae.callNativeApiStatus().then(function(status) {
		status=status||{};
		var resources=status.resources||{};
		if(resources.flows!==true)
			return {id:id,status:status,detail:null,rules:null,dnsRules:null};

		var tasks=[
			dae.callNativeFlowGet(String(id)).then(native.parse),
			resources.rules===true ? dae.callNativeApiGet('rules').then(native.parse) : Promise.resolve(null),
			resources.dns_rules===true ? dae.callNativeApiGet('dns_rules').then(native.parse) : Promise.resolve(null)
		];
		return Promise.all(tasks).then(function(v) {
			return {
				id:id,
				status:status,
				detail:v[0],
				rules:v[1]&&v[1].ok?v[1].data:null,
				rulesError:v[1]&&!v[1].ok?v[1]:null,
				dnsRules:v[2]&&v[2].ok?v[2].data:null,
				dnsRulesError:v[2]&&!v[2].ok?v[2]:null
			};
		});
	});
}

return view.extend({
	load:function() {
		return flowContext(flowIdFromLocation());
	},

	render:function(ctx) {
		ctx=ctx||{};
		var back=E('a',{
			'class':'btn cbi-button',
			'href':L.url('admin/services/dae-ui/flows')
		},_('Back to Flows'));

		if(!ctx.id)
			return E([],[
				E('h2',{},_('Flow Detail')),
				E('div',{'class':'alert-message warning'},_('No flow ID was supplied in the page URL.')),
				E('p',{},back)
			]);

		if(!(ctx.status&&ctx.status.resources&&ctx.status.resources.flows===true))
			return E([],[
				E('h2',{},_('Flow Detail')),
				native.unavailable(ctx.status||{},'flows'),
				E('p',{},back)
			]);

		if(!ctx.detail||!ctx.detail.ok)
			return E([],[
				E('h2',{},_('Flow Detail · ')+ctx.id),
				native.errorBox(ctx.detail||{error:_('Flow detail is unavailable.')}),
				E('p',{},back)
			]);

		var detail=ctx.detail.data||{};
		return E([],[
			E('div',{'style':'display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap'},[
				E('h2',{},_('Flow Detail · ')+native.text(detail.id||ctx.id)),
				back
			]),
			E('div',{'class':'cbi-map-descr'},_('Shareable retained-flow view. The flow ID in the URL is the only requested identity. Rule links are still generation-qualified and are created only when retained evidence matches the current dictionary generation.')),
			flowtrace.summaryNode(detail,{traffic:ctx.rules,dns:ctx.dnsRules}),
			ctx.rulesError?E('div',{'class':'alert-message notice'},[
				_('The retained flow is available, but the current traffic rule dictionary could not be loaded: '),
				ctx.rulesError.error
			]):null,
			ctx.dnsRulesError?E('div',{'class':'alert-message notice'},[
				_('The retained flow is available, but the current DNS rule dictionary could not be loaded: '),
				ctx.dnsRulesError.error
			]):null,
			E('h3',{},_('Retained trace timeline')),
			E('div',{'class':'cbi-map-descr'},_('Steps are rendered from retained backend evidence. No routing decision is simulated on this page.')),
			flowtrace.traceNode(detail,{traffic:ctx.rules,dns:ctx.dnsRules}),
			E('details',{'style':'margin-top:12px'},[
				E('summary',{},_('Raw flow detail')),
				E('pre',{'style':'white-space:pre-wrap;max-height:520px;overflow:auto'},JSON.stringify(detail,null,2))
			])
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
