'use strict';
'require baseclass';
'require daeui.native as native';

var STAGES = {
	input: _('Input'),
	route: _('Route'),
	datapath: _('Datapath'),
	dial_mode: _('Dial mode'),
	dns: _('DNS'),
	reroute: _('Reroute'),
	outbound: _('Outbound'),
	connection: _('Connection')
};

function yesNo(value) {
	if (value === null || value === undefined) return '-';
	return value ? _('Yes') : _('No');
}

function elapsed(value) {
	if (value === null || value === undefined) return '-';
	var n=Number(value);
	if (!Number.isFinite(n)) return native.text(value);
	if (n < 1000) return n.toFixed(0) + ' µs';
	if (n < 1000000) return (n / 1000).toFixed(2) + ' ms';
	return (n / 1000000).toFixed(3) + ' s';
}

function valueText(value) {
	if (value === null || value === undefined || value === '') return '-';
	if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

function kv(rows) {
	return E('div', { 'class':'table' }, (rows || []).map(function(row) {
		return E('div', { 'class':'tr' }, [
			E('div', { 'class':'td left', 'style':'width:180px;font-weight:600' }, row[0]),
			E('div', { 'class':'td left' }, row[1] && typeof row[1] === 'object' && row[1].nodeType ? row[1] : valueText(row[1]))
		]);
	}));
}

function findRule(rules, ruleId) {
	var list=(rules&&rules.rules)||[];
	for(var i=0;i<list.length;i++)
		if(list[i].rule_id===ruleId) return list[i];
	if(rules&&rules.fallback&&rules.fallback.rule_id===ruleId) return rules.fallback;
	return null;
}

function trafficRuleEvidence(detail, ruleId) {
	var matches=((detail&&detail.trace&&detail.trace.steps)||[]).filter(function(step) {
		return step && step.stage==='route' && step.data && step.data.chain==='traffic' &&
			step.data.rule_id===ruleId && step.generation_id;
	}).sort(function(a,b) {
		return Number(a.seq||0)-Number(b.seq||0);
	});
	return matches.length ? matches[matches.length-1] : null;
}

function generationRuleLink(step, rulesData) {
	if (!step || step.stage !== 'route' || !step.data || step.data.chain !== 'traffic' ||
		!step.data.rule_id || !step.generation_id || !rulesData)
		return null;
	if (String(step.generation_id) !== String(rulesData.generation_id || ''))
		return null;
	var rule=findRule(rulesData,String(step.data.rule_id));
	if(!rule) return null;
	var href=L.url('admin/services/dae-ui/native-rules')+
		'?rule='+encodeURIComponent(String(rule.rule_id))+
		'&generation='+encodeURIComponent(String(step.generation_id));
	return E('a', { 'href':href }, E('code', {}, native.text(rule.rule_id)));
}

function inputFields(step) {
	var values=step.data&&step.data.values||{};
	var rows=[];
	Object.keys(values).sort().forEach(function(k) {
		var v=values[k];
		if(v===null||v===undefined||v==='') return;
		rows.push([k,valueText(v)]);
	});
	if(step.data&&step.data.source) rows.unshift([_('Source'),step.data.source]);
	return rows;
}

function routeFields(step, rulesData) {
	var d=step.data||{};
	var link=generationRuleLink(step,rulesData);
	return [
		[_('Chain'),d.chain],
		[_('Plane'),d.plane],
		[_('Rule ID'),link||d.rule_id],
		[_('Outbound / upstream'),d.outbound],
		[_('Must'),yesNo(d.must)],
		[_('Mark'),d.mark],
		[_('Evaluation ID'),d.evaluation_id]
	];
}

function datapathFields(step) {
	var d=step.data||{};
	return [
		[_('Plane'),d.plane],
		[_('Action'),d.action],
		[_('Reason'),d.reason],
		[_('Error'),d.error]
	];
}

function dialModeFields(step) {
	var d=step.data||{};
	return [
		[_('Configured'),d.configured],
		[_('Effective target'),d.effective_target],
		[_('Domain'),d.domain],
		[_('Domain source'),d.domain_source],
		[_('Verification'),d.verification],
		[_('Reason'),d.reason]
	];
}

function dnsFields(step) {
	var d=step.data||{};
	return [
		[_('Purpose'),d.purpose],
		[_('Question'),(d.name||'-')+(d.qtype?' · '+d.qtype:'')],
		[_('Source'),d.source],
		[_('Cache'),d.cache],
		[_('Upstream'),d.upstream],
		[_('Upstream transport'),d.upstream_transport],
		[_('Carrier transport'),d.carrier_transport],
		[_('Status'),d.status],
		[_('Selected IP'),d.selected_ip],
		[_('Addresses'),d.addresses],
		[_('Lookup ID'),d.lookup_id],
		[_('Error'),d.error]
	];
}

function rerouteFields(step) {
	var d=step.data||{};
	return [
		[_('Performed'),yesNo(d.performed)],
		[_('Reason'),d.reason],
		[_('From evaluation'),d.from_evaluation_id],
		[_('To evaluation'),d.to_evaluation_id]
	];
}

function selectionPath(path) {
	path=path||[];
	if(!path.length) return '-';
	return path.map(function(p) {
		var member=p.member_name||p.member_id||'-';
		return (p.group_id||'-')+' → '+member+(p.policy?' ['+p.policy+']':'');
	}).join(' / ');
}

function outboundFields(step) {
	var d=step.data||{};
	return [
		[_('Routing source'),d.routing_source],
		[_('Routed outbound'),d.routed_outbound],
		[_('Effective outbound'),d.effective_outbound],
		[_('Selection path'),selectionPath(d.selection_path)],
		[_('Leaf node'),d.leaf_node_name||d.leaf_node_id],
		[_('Target'),d.target],
		[_('Target kind'),d.target_kind],
		[_('Dial IP'),d.dial_ip],
		[_('Server address'),d.server_addr],
		[_('Resolution'),d.resolution_location],
		[_('Status'),d.status],
		[_('Attempt ID'),d.attempt_id],
		[_('Error'),d.error]
	];
}

function connectionFields(step) {
	var d=step.data||{};
	return [
		[_('State'),d.state],
		[_('Milestone'),d.milestone],
		[_('Reason'),d.reason],
		[_('Attempt ID'),d.attempt_id],
		[_('Reply received'),yesNo(d.reply_received)],
		[_('Error'),d.error]
	];
}

function fieldsFor(step, rulesData) {
	switch(step.stage) {
	case 'input': return inputFields(step);
	case 'route': return routeFields(step,rulesData);
	case 'datapath': return datapathFields(step);
	case 'dial_mode': return dialModeFields(step);
	case 'dns': return dnsFields(step);
	case 'reroute': return rerouteFields(step);
	case 'outbound': return outboundFields(step);
	case 'connection': return connectionFields(step);
	default: return [];
	}
}

function ruleEvaluations(step) {
	if(!step||step.stage!=='route'||!step.data||!Array.isArray(step.data.rules)||!step.data.rules.length)
		return null;
	var rows=step.data.rules.map(function(r) {
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},E('code',{},native.text(r.rule_id))),
			E('td',{'class':'td'},native.text(r.result)),
			E('td',{'class':'td'},E('code',{},native.text(r.expression))),
			E('td',{'class':'td'},native.text(r.missing_inputs))
		]);
	});
	return E('div',{'style':'margin-top:10px'},[
		E('strong',{},_('Rule evaluations')),
		native.table([_('Rule ID'),_('Result'),_('Expression'),_('Missing inputs')],rows)
	]);
}

function selectionCandidates(step) {
	if(!step||step.stage!=='outbound'||!step.data||!Array.isArray(step.data.selection_path))
		return null;
	var rows=[];
	step.data.selection_path.forEach(function(path) {
		var candidates=path.selection&&path.selection.candidates||[];
		candidates.forEach(function(c) {
			rows.push(E('tr',{'class':'tr'},[
				E('td',{'class':'td'},native.text(path.group_id)),
				E('td',{'class':'td'},native.text(c.member_name||c.member_id)),
				E('td',{'class':'td'},yesNo(c.eligible)),
				E('td',{'class':'td'},c.sorting_latency_ms===null||c.sorting_latency_ms===undefined?'-':String(c.sorting_latency_ms)+' ms'),
				E('td',{'class':'td'},c.score===null||c.score===undefined?'-':String(c.score)),
				E('td',{'class':'td'},yesNo(c.selected)),
				E('td',{'class':'td'},native.text(c.reason))
			]));
		});
	});
	if(!rows.length) return null;
	return E('div',{'style':'margin-top:10px'},[
		E('strong',{},_('Selection candidates')),
		native.table([_('Group'),_('Member'),_('Eligible'),_('Latency'),_('Score'),_('Selected'),_('Reason')],rows)
	]);
}

function stepNode(step, rulesData) {
	var header=E('div',{
		'style':'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px'
	},[
		E('strong',{},'#'+String(step.seq===undefined?'-':step.seq)+' · '+(STAGES[step.stage]||step.stage||_('Unknown'))),
		E('span',{'class':'label'},native.text(step.evidence)),
		E('span',{'class':'cbi-map-descr'},native.time(step.observed_at)),
		E('span',{'class':'cbi-map-descr'},'+'+elapsed(step.elapsed_us)),
		step.generation_id?E('span',{'class':'cbi-map-descr'},[
			_('generation '),E('code',{},native.text(step.generation_id))
		]):null
	]);

	return E('div',{
		'class':'cbi-section',
		'style':'margin:10px 0;padding:12px;border-left:4px solid var(--primary-color,#337ab7)'
	},[
		header,
		kv(fieldsFor(step,rulesData)),
		ruleEvaluations(step),
		selectionCandidates(step),
		E('details',{'style':'margin-top:8px'},[
			E('summary',{},_('Raw step data')),
			E('pre',{'style':'white-space:pre-wrap;max-height:320px;overflow:auto'},JSON.stringify(step,null,2))
		])
	]);
}

function traceNode(detail, rulesData) {
	var trace=detail&&detail.trace||{};
	var steps=(trace.steps||[]).slice().sort(function(a,b){return Number(a.seq||0)-Number(b.seq||0);});
	var missing=trace.missing||[];
	return E('div',{},[
		trace.status&&trace.status!=='complete'?E('div',{'class':'alert-message warning'},[
			_('Trace status: '),E('strong',{},native.text(trace.status)),
			missing.length?' · '+_('Missing: ') + missing.join(', '):''
		]):E('div',{'class':'alert-message success'},_('Trace status: complete')),
		steps.length?E('div',{},steps.map(function(step){return stepNode(step,rulesData);})):
			E('div',{'class':'alert-message notice'},_('No retained trace steps were returned.'))
	]);
}

function safeTopRule(detail, rulesData) {
	if(!detail||!detail.rule_id||!rulesData) return null;
	var evidence=trafficRuleEvidence(detail,String(detail.rule_id));
	if(!evidence||String(evidence.generation_id||'')!==String(rulesData.generation_id||'')) return null;
	var rule=findRule(rulesData,String(detail.rule_id));
	if(!rule) return null;
	var href=L.url('admin/services/dae-ui/native-rules')+
		'?rule='+encodeURIComponent(String(rule.rule_id))+
		'&generation='+encodeURIComponent(String(evidence.generation_id));
	return E('a',{'href':href},E('code',{},native.text(rule.rule_id)));
}

function summaryNode(detail, rulesData) {
	var input=detail&&detail.input||{};
	var topRule=safeTopRule(detail,rulesData);
	return E('div',{'class':'cbi-section'},[
		E('h3',{},_('Flow summary')),
		kv([
			[_('Flow ID'),E('code',{},native.text(detail.id))],
			[_('Instance ID'),E('code',{},native.text(detail.instance_id))],
			[_('Revision'),detail.revision],
			[_('Network'),detail.network],
			[_('State'),detail.state],
			[_('Process'),detail.pname],
			[_('Source'),input.src],
			[_('Destination'),input.dst],
			[_('Domain'),input.domain],
			[_('Domain source'),input.domain_source],
			[_('Outbound'),detail.outbound],
			[_('Rule'),topRule||detail.rule_id],
			[_('Rule expression'),detail.rule_expression],
			[_('Rule source'),detail.rule_source],
			[_('Observed by'),detail.observed_by],
			[_('Started'),native.time(detail.started_at)],
			[_('Ended'),native.time(detail.ended_at)],
			[_('Connection ID'),detail.connection_id]
		])
	]);
}

return baseclass.extend({
	elapsed:elapsed,
	findRule:findRule,
	trafficRuleEvidence:trafficRuleEvidence,
	safeTopRule:safeTopRule,
	summaryNode:summaryNode,
	traceNode:traceNode
});
