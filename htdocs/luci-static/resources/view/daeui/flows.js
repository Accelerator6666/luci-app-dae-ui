'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';
'require daeui.native as native';

function renderData(result){
	if(!result||!result.ok) return native.errorBox(result);
	var data=result.data||{},flows=data.flows||[];
	var rows=flows.map(function(f){
		var target=f.domain||f.dst||f.destination||f.target||'-';
		var state=f.state||f.status||'-';
		var outbound=f.outbound||f.final_outbound||'-';
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},E('code',{},native.text(f.id))),
			E('td',{'class':'td'},native.text(f.network||f.transport)),
			E('td',{'class':'td'},native.text(state)),
			E('td',{'class':'td'},E('code',{},native.text(target))),
			E('td',{'class':'td'},native.text(outbound)),
			E('td',{'class':'td'},native.text(f.connection_id)),
			E('td',{'class':'td'},native.time(f.started_at||f.observed_at))
		]);
	});
	return E([],[
		E('div',{'class':'cbi-map-descr'},_('Flows returned: ')+(data.total!==undefined?data.total:flows.length)+(data.next_cursor?' · '+_('more pages available'):'') ),
		native.table([_('Flow ID'),_('Network'),_('State'),_('Target'),_('Outbound'),_('Connection'),_('Time')],rows)
	]);
}

return view.extend({
	load:function(){return native.loadResource('flows');},
	refresh:function(){
		return dae.callNativeApiGet('flows').then(function(res){
			var box=document.getElementById('native-flows');
			if(box) dom.content(box,renderData(native.parse(res)));
		});
	},
	render:function(data){
		var status=data.status||{},available=status.resources&&status.resources.flows===true;
		if(available) poll.add(L.bind(this.refresh,this),5);
		return E([],[
			E('h2',{},_('Native Flows')),
			E('div',{'class':'cbi-map-descr'},_('Read-only retained flow summaries from /api/v1/flows. Detailed trace actions are intentionally not sent by this page.')),
			E('div',{'id':'native-flows'},available?renderData(data.resource):native.unavailable(status,'flows'))
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
