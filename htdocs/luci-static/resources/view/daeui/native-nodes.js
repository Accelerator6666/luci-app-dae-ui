'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';
'require daeui.native as native';

function latency(node, transport) {
	var best = null;
	(node.health || []).forEach(function(h) {
		if (h.transport !== transport || h.latency_ms === null || h.latency_ms === undefined) return;
		var n=Number(h.latency_ms);
		if (Number.isFinite(n) && (best===null || n<best)) best=n;
	});
	return best===null ? '-' : best.toFixed(0)+' ms';
}

function renderData(result) {
	if(!result||!result.ok) return native.errorBox(result);
	var data=result.data||{};
	var nodes=data.nodes||[];
	var rows=nodes.map(function(n){
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},native.text(n.name||n.id)),
			E('td',{'class':'td'},native.text(n.protocol)),
			E('td',{'class':'td'},native.text(n.provider_id||n.subscription_tag)),
			E('td',{'class':'td'},native.text(n.group_ids)),
			E('td',{'class':'td'},latency(n,'tcp')),
			E('td',{'class':'td'},latency(n,'udp'))
		]);
	});
	return E([],[
		E('div',{'class':'cbi-map-descr'},_('Nodes returned: ')+(data.total!==undefined?data.total:nodes.length)+(data.next_cursor?' · '+_('more pages available'):'') ),
		native.table([_('Node'),_('Protocol'),_('Provider'),_('Groups'),_('TCP latency'),_('UDP latency')],rows)
	]);
}

return view.extend({
	load:function(){return native.loadResource('nodes');},
	refresh:function(){
		return dae.callNativeApiGet('nodes').then(function(res){
			var box=document.getElementById('native-nodes');
			if(box) dom.content(box,renderData(native.parse(res)));
		});
	},
	render:function(data){
		var status=data.status||{},available=status.resources&&status.resources.nodes===true;
		if(available) poll.add(L.bind(this.refresh,this),10);
		return E([],[
			E('h2',{},_('Native Nodes & Latency')),
			E('div',{'class':'cbi-map-descr'},_('Read-only node inventory and health observations reported by the Native API. Latency values are backend probe observations, not browser pings.')),
			E('div',{'id':'native-nodes'},available?renderData(data.resource):native.unavailable(status,'nodes'))
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
