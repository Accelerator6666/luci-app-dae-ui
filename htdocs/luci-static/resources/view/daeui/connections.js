'use strict';
'require view';
'require poll';
'require dom';
'require ui';
'require daeui.common as dae';
'require daeui.native as native';
'require daeui.flowtrace as flowtrace';

function flowPageUrl(id) {
	return L.url('admin/services/dae-ui/flow-detail')+'?id='+encodeURIComponent(String(id||''));
}

function flatten(data) {
	var out = [];
	[ ['tcp', data && data.tcp], ['udp', data && data.udp] ].forEach(function(pair) {
		(pair[1] || []).forEach(function(c) {
			out.push(Object.assign({ _network: pair[0] }, c));
		});
	});
	return out;
}

function target(c) {
	return c.domain || c.dst || c.destination || '-';
}

function processName(c) {
	return c.pname || c.process || c.process_name || '-';
}

function buildGrid(rows, canOpenFlow, flowHandler) {
	return native.dataGrid(rows, {
		searchPlaceholder: _('Search source, target, outbound or process…'),
		pageSize: 50,
		filters: [
			{ key:'network', title:_('network'), value:function(c){ return c._network || ''; }, options:['tcp','udp'] },
			{ key:'state', title:_('state'), value:function(c){ return native.text(c.state, ''); } },
			{ key:'outbound', title:_('outbound'), value:function(c){ return native.text(c.outbound, ''); } }
		],
		search: function(c) {
			return [
				c.src, target(c), c.outbound, processName(c), c.state, c.id, c.flow_id, c.rule_id, c.rule_expression
			].join(' ');
		},
		columns: [
			{ key:'network', title:_('Network'), value:function(c){ return (c._network || '').toUpperCase(); } },
			{ key:'state', title:_('State'), value:function(c){ return native.text(c.state, ''); } },
			{ key:'src', title:_('Source'), value:function(c){ return native.text(c.src, ''); }, render:function(c){ return E('code',{},native.text(c.src)); } },
			{ key:'target', title:_('Target'), value:target, render:function(c){ return E('code',{},native.text(target(c))); } },
			{ key:'outbound', title:_('Outbound'), value:function(c){ return native.text(c.outbound, ''); } },
			{ key:'process', title:_('Process'), value:processName },
			{ key:'up', title:_('Upload'), numeric:true, value:function(c){ return Number(c.upload_bytes_per_second || 0); }, render:function(c){ return native.humanRate(c.upload_bytes_per_second); } },
			{ key:'down', title:_('Download'), numeric:true, value:function(c){ return Number(c.download_bytes_per_second || 0); }, render:function(c){ return native.humanRate(c.download_bytes_per_second); } },
			{ key:'trace', title:_('Flow trace'), sortable:false, value:function(){return '';}, render:function(c) {
				if(!canOpenFlow || !c.flow_id) return '-';
				return E('span',{},[
					E('button',{
						'class':'btn cbi-button cbi-button-action',
						'click':function(){return flowHandler(c);}
					},_('Timeline')),
					' ',
					E('a',{
						'class':'btn cbi-button',
						'href':flowPageUrl(c.flow_id)
					},_('Open page'))
				]);
			} }
		]
	});
}

function meta(data) {
	data = data || {};
	var totalTcp = data.total_tcp !== undefined ? data.total_tcp : ((data.tcp || []).length);
	var totalUdp = data.total_udp !== undefined ? data.total_udp : ((data.udp || []).length);
	return _('TCP: ') + totalTcp + ' · ' + _('UDP: ') + totalUdp +
		(data.truncated ? ' · ' + _('backend snapshot truncated at requested limit') : '');
}

return view.extend({
	load: function() {
		return native.loadResource('connections', { limit:1000 });
	},

	refresh: function() {
		return dae.callNativeApiGet('connections', { limit:1000 }).then(function(res) {
			var parsed = native.parse(res);
			var info = document.getElementById('native-connections-meta');
			if (!parsed.ok) {
				var box = document.getElementById('native-connections');
				if (box) dom.content(box, native.errorBox(parsed));
				return;
			}
			if (info) info.textContent = meta(parsed.data);
			if (this.grid) this.grid.setRows(flatten(parsed.data));
		}.bind(this));
	},

	viewConnectionFlow:function(connection) {
		if(!connection||!connection.flow_id) return;
		ui.showModal(_('Flow trace'),[
			E('p',{'class':'spinning'},_('Loading retained flow detail for this connection…'))
		]);

		var tasks=[
			dae.callNativeFlowGet(String(connection.flow_id)).then(native.parse),
			this.canResolveRule ? dae.callNativeApiGet('rules').then(native.parse) : Promise.resolve(null),
			this.canResolveDnsRule ? dae.callNativeApiGet('dns_rules').then(native.parse) : Promise.resolve(null)
		];

		return Promise.all(tasks).then(function(v){
			var detail=v[0];
			var rulesResult=v[1];
			var dnsRulesResult=v[2];
			if(!detail.ok) {
				ui.showModal(_('Flow trace'),[
					native.errorBox(detail),
					E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
				]);
				return;
			}
			var rules=rulesResult&&rulesResult.ok?rulesResult.data:null;
			var dnsRules=dnsRulesResult&&dnsRulesResult.ok?dnsRulesResult.data:null;
			var data=detail.data||{};

			ui.showModal(_('Flow trace · ')+native.text(data.id),[
				E('div',{'style':'max-height:72vh;overflow:auto;padding-right:6px'},[
					E('div',{'class':'alert-message notice'},[
						_('Opened from connection '),E('code',{},native.text(connection.id)),
						_('. The backend-provided flow_id is authoritative; this UI does not fabricate a flow for unrecorded connections.')
					]),
					flowtrace.summaryNode(data,{traffic:rules,dns:dnsRules}),
					rulesResult&&!rulesResult.ok?E('div',{'class':'alert-message notice'},[
						_('The flow trace is available, but the current traffic rule dictionary could not be loaded: '),
						rulesResult.error
					]):null,
					dnsRulesResult&&!dnsRulesResult.ok?E('div',{'class':'alert-message notice'},[
						_('The flow trace is available, but the current DNS rule dictionary could not be loaded: '),
						dnsRulesResult.error
					]):null,
					E('h3',{},_('Retained trace timeline')),
					flowtrace.traceNode(data,{traffic:rules,dns:dnsRules}),
					E('details',{'style':'margin-top:12px'},[
						E('summary',{},_('Raw flow detail')),
						E('pre',{'style':'white-space:pre-wrap;max-height:420px;overflow:auto'},JSON.stringify(data,null,2))
					])
				]),
				E('div',{'class':'right','style':'margin-top:12px'},[
					E('button',{'class':'btn','click':ui.hideModal},_('Close')),
					' ',
					E('a',{'class':'btn cbi-button cbi-button-action','href':flowPageUrl(data.id||connection.flow_id)},_('Open detail page'))
				])
			]);
		});
	},

	render: function(data) {
		var status = data.status || {};
		var available = status.resources && status.resources.connections === true;
		this.canOpenFlow=!!(status.resources&&status.resources.flows===true);
		this.canResolveRule=!!(status.resources&&status.resources.rules===true);
		this.canResolveDnsRule=!!(status.resources&&status.resources.dns_rules===true);

		if (!available) {
			return E([], [
				E('h2', {}, _('Native Connections')),
				native.unavailable(status, 'connections')
			]);
		}

		if (!data.resource || !data.resource.ok) {
			return E([], [
				E('h2', {}, _('Native Connections')),
				native.errorBox(data.resource)
			]);
		}

		this.grid = buildGrid(flatten(data.resource.data),this.canOpenFlow,this.viewConnectionFlow.bind(this));
		poll.add(L.bind(this.refresh, this), 3);

		return E([], [
			E('h2', {}, _('Native Connections')),
			E('div', { 'class':'cbi-map-descr' }, _('Read-only connection snapshot. When the backend records a flow_id, Timeline opens that exact retained causal trace; connections without a recorded flow remain unlinked.')),
			E('div', { 'id':'native-connections-meta', 'class':'cbi-map-descr' }, meta(data.resource.data)),
			E('div', { 'id':'native-connections' }, this.grid.node)
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
