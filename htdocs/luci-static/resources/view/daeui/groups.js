'use strict';
'require view';
'require daeui.common as dae';
'require daeui.managed as managed';
'require daeui.cards as cards';
'require daeui.native as native';

function bestLatency(node, transport) {
	var best=null;
	((node&&node.health)||[]).forEach(function(h){
		if(h.transport!==transport || h.latency_ms===null || h.latency_ms===undefined) return;
		var n=Number(h.latency_ms);
		if(Number.isFinite(n) && (best===null || n<best)) best=n;
	});
	return best;
}

function safeName(value) {
	return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(String(value||''));
}

function uniqueByName(items) {
	var seen={};
	return (items||[]).filter(function(item){
		if(!item || !item.name || seen[item.name]) return false;
		seen[item.name]=true;
		return true;
	});
}

function sourceInventory(all, runtimeNodes) {
	var nodes=[],subscriptions=[];
	((all&&all.sections)||[]).forEach(function(sec){
		if(sec.name==='node') {
			cards.nodeCards(sec.content).forEach(function(n){
				if(n.name && safeName(n.name)) nodes.push({name:n.name,source:sec.source});
			});
		}
		if(sec.name==='subscription') {
			cards.subscriptionCards(sec.content).forEach(function(sub){
				if(sub.name && safeName(sub.name)) subscriptions.push({name:sub.name,source:sec.source});
			});
		}
	});

	nodes=uniqueByName(nodes);
	subscriptions=uniqueByName(subscriptions);
	nodes.forEach(function(item){
		var matches=(runtimeNodes||[]).filter(function(n){
			return String(n.name||'')===item.name || String(n.id||'')===item.name;
		});
		if(matches.length!==1) return;
		item.runtime=matches[0];
		item.tcp=bestLatency(matches[0],'tcp');
		item.udp=bestLatency(matches[0],'udp');
	});
	return {nodes:nodes,subscriptions:subscriptions};
}

function optionLabel(node) {
	var parts=[node.name];
	if(node.tcp!==null && node.tcp!==undefined) parts.push('TCP '+Number(node.tcp).toFixed(0)+' ms');
	if(node.udp!==null && node.udp!==undefined) parts.push('UDP '+Number(node.udp).toFixed(0)+' ms');
	return parts.join(' · ');
}

function selectedValues(select) {
	return Array.prototype.slice.call(select.options||[]).filter(function(o){
		return o.selected;
	}).map(function(o){return o.value;});
}

function quick(id, inventory) {
	inventory=inventory||{nodes:[],subscriptions:[]};
	var name=E('input',{'class':'cbi-input-text','placeholder':_('group name'),'style':'min-width:180px'});
	var policy=E('select',{'class':'cbi-input-select'},[
		'min','min_moving_avg','min_avg10','random','fixed(0)'
	].map(function(p){return E('option',{'value':p},p);}));
	var nodeSelect=E('select',{
		'class':'cbi-input-select',
		'multiple':'',
		'size':Math.min(8,Math.max(4,inventory.nodes.length||4)),
		'style':'min-width:300px;max-width:100%'
	},inventory.nodes.map(function(n){
		return E('option',{'value':n.name},optionLabel(n));
	}));
	var subSelect=E('select',{'class':'cbi-input-select','style':'min-width:220px'},[
		E('option',{'value':''},_('No subscription filter')),
		inventory.subscriptions.map(function(sub){
			return E('option',{'value':sub.name},sub.name);
		})
	]);
	var filter=E('input',{
		'class':'cbi-input-text',
		'placeholder':_("optional advanced filter, e.g. name(keyword: 'HK')"),
		'style':'min-width:320px;flex:1'
	});

	var stage=function(){
		var n=(name.value||'').trim();
		if(!safeName(n)) {
			dae.notify(_('Group name must be a safe DAE identifier.'),'error');
			return;
		}
		var chosen=selectedValues(nodeSelect);
		var sub=(subSelect.value||'').trim();
		var manual=(filter.value||'').trim();
		var filters=[];
		if(chosen.length) filters.push('name('+chosen.join(', ')+')');
		if(sub) filters.push('subtag('+sub+')');
		if(manual) filters.push(manual);
		if(!filters.length) {
			dae.notify(_('Select at least one node/subscription or enter an advanced filter.'),'warning');
			return;
		}
		var text=n+' {\n';
		filters.forEach(function(f){text+='    filter: '+f+'\n';});
		text+='    policy: '+policy.value+'\n}';
		managed.appendLine(id,text);
		name.value='';
		filter.value='';
		subSelect.value='';
		Array.prototype.forEach.call(nodeSelect.options||[],function(o){o.selected=false;});
	};

	return E('div',{'class':'cbi-section','style':'margin:10px 0'},[
		E('h4',{},_('Visual group builder')),
		E('div',{'class':'cbi-map-descr'},_('Select exact source node tags and/or a subscription tag. Multiple filter lines use DAE group OR semantics. The generated text is only staged in the managed editor below; Preview diff remains available before any write.')),
		E('div',{'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0'},[
			name,policy
		]),
		E('div',{'style':'display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap'},[
			E('div',{},[
				E('div',{'class':'cbi-map-descr'},_('Exact node tags')),
				nodeSelect
			]),
			E('div',{},[
				E('div',{'class':'cbi-map-descr'},_('Subscription tag')),
				subSelect
			])
		]),
		E('div',{'style':'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px'},[
			filter,
			E('button',{'class':'btn cbi-button','click':stage},_('Stage policy group'))
		])
	]);
}

function unwrapGroups(data) {
	if(Array.isArray(data)) return data;
	return (data&&data.groups)||[];
}

function selectText(group, network) {
	if(group&&group.selection) {
		var id=network==='tcp'?group.selection.tcp_member_id:group.selection.udp_member_id;
		return native.text(id);
	}
	var s=group&&group.runtime&&group.runtime.selection&&group.runtime.selection[network];
	if(!s) return '-';
	return native.text(s.member_id||s.resolved_leaf_node_id||s);
}

function exactRuntimeGroup(name, runtimeGroups) {
	if(!name) return null;
	var matches=(runtimeGroups||[]).filter(function(g){
		return String(g.name||'')===name || String(g.id||'')===name;
	});
	return matches.length===1 ? matches[0] : null;
}

function runtimeGroupNode(group) {
	if(!group) return null;
	var count=group.member_count!==undefined ? Number(group.member_count||0) : ((group.members||[]).length);
	return E('div',{'class':'cbi-map-descr','style':'margin-top:6px'},[
		_('Runtime snapshot: '),
		_('TCP selection')+' '+selectText(group,'tcp'),
		' · ',
		_('UDP selection')+' '+selectText(group,'udp'),
		' · ',
		String(count)+' '+_('member(s)')
	]);
}

function renderCards(all,runtimeGroups){
	var items=[];
	((all&&all.sections)||[]).filter(function(s){return s.name==='group';}).forEach(function(sec){
		cards.groupCards(sec.content).forEach(function(g){g.source=sec.source;items.push(g);});
	});
	return items.length ? E('div',{},items.map(function(g){
		var rt=exactRuntimeGroup(g.name,runtimeGroups);
		return cards.card(g.name, _('Policy: ')+g.policy+' · '+g.source, E('div',{},[
			E('code',{},g.filter),
			runtimeGroupNode(rt)
		]));
	})) : E('div',{'class':'alert-message notice'},_('No policy groups could be summarized.'));
}

return view.extend({
	load:function(){
		return Promise.all([
			dae.callGetSections(),
			dae.callGetManagedSection('groups'),
			dae.callNativeApiStatus().then(function(status){
				status=status||{};
				var resources=status.resources||{};
				var nodes=resources.nodes===true
					? dae.callNativeApiGet('nodes',{limit:1000}).then(native.parse)
					: Promise.resolve(null);
				var groups=resources.groups===true
					? dae.callNativeApiGet('groups',{limit:1000}).then(native.parse)
					: Promise.resolve(null);
				return Promise.all([nodes,groups]).then(function(parts){
					return {status:status,nodes:parts[0],groups:parts[1]};
				});
			}).catch(function(){return {status:{},nodes:null,groups:null};})
		]);
	},
	render:function(data){
		var runtime=data[2]||{};
		var nodeData=runtime.nodes&&runtime.nodes.ok ? (runtime.nodes.data||{}) : {};
		var groupData=runtime.groups&&runtime.groups.ok ? runtime.groups.data : {};
		var runtimeNodes=nodeData.nodes||[];
		var runtimeGroups=unwrapGroups(groupData);
		var inventory=sourceInventory(data[0],runtimeNodes);
		var partial=!!nodeData.next_cursor;
		return E([],[
			E('h2',{},_('Policy Groups')),
			E('div',{'class':'cbi-map-descr'},_('Policy cards summarize common group syntax. Existing groups remain user-owned and are never rewritten by the quick editor.')),
			runtime.groups&&runtime.groups.ok
				? E('div',{'class':'alert-message success'},_('Native runtime policy correlation is available for exact group names. Current TCP/UDP selections are shown as a read-only snapshot.'))
				: E('div',{'class':'alert-message notice'},_('Native runtime policy data is unavailable; source policy editing is unaffected.')),
			partial
				? E('div',{'class':'alert-message notice'},_('Native node inventory has additional server pages. Latency labels in the visual builder are therefore partial.'))
				: null,
			managed.includeBanner(data[1]),
			E('h3',{},_('Policy cards')),
			renderCards(data[0],runtimeGroups),
			E('h3',{},_('Source configuration')),
			managed.existingSections(data[0],['group']),
			managed.editor(
				'groups',
				data[1],
				_('The visual builder stages exact node/subscription filters and valid DAE policy syntax. Advanced filters can still be edited directly before previewing or applying.'),
				function(id){return quick(id,inventory);}
			)
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
