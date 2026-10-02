'use strict';
'require view';
'require poll';
'require dom';
'require ui';
'require daeui.common as dae';
'require daeui.native as native';

function offered(values, wanted) {
	return Array.isArray(values) && values.indexOf(wanted) >= 0;
}

function unwrapGroups(data) {
	if (Array.isArray(data)) return data;
	return (data && data.groups) || [];
}

function selectText(group, network) {
	if (group && group.selection) {
		var id = network === 'tcp' ? group.selection.tcp_member_id : group.selection.udp_member_id;
		return native.text(id);
	}
	var s=group&&group.runtime&&group.runtime.selection&&group.runtime.selection[network];
	if(!s) return '-';
	return native.text(s.member_id||s.resolved_leaf_node_id||s);
}

function memberCount(group) {
	if (group && group.member_count !== undefined) return Number(group.member_count || 0);
	return (group && group.members ? group.members.length : 0);
}

function policyKind(group) {
	var p=group&&group.policy;
	return p&&typeof p==='object'?(p.kind||p.type||JSON.stringify(p)):native.text(p);
}

function transportsFor(probes, kind, group) {
	var allowed=(probes.transports||[]).filter(function(t) {
		return !group || !group.capabilities || !Array.isArray(group.capabilities.probe_transports) ||
			group.capabilities.probe_transports.indexOf(t)>=0;
	});
	if(kind==='tcp_connect'||kind==='http')
		return allowed.indexOf('tcp')>=0?['tcp']:[];
	return allowed;
}

function ipChoices(probes) {
	var out=[];
	var v4=offered(probes.ip_versions,'ipv4');
	var v6=offered(probes.ip_versions,'ipv6');
	if(v4&&v6) out.push('any');
	if(v4) out.push('ipv4');
	if(v6) out.push('ipv6');
	return out;
}

function resultTable(result) {
	var rows=(result.results||[]).map(function(r){
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},native.text(r.member_id)),
			E('td',{'class':'td'},native.text(r.resolved_leaf_node_id)),
			E('td',{'class':'td'},native.text(r.kind)),
			E('td',{'class':'td'},native.text(r.transport)),
			E('td',{'class':'td'},native.text(r.ip_version)),
			E('td',{'class':'td'},native.text(r.state)),
			E('td',{'class':'td'},r.latency_ms===null||r.latency_ms===undefined?'-':String(r.latency_ms)+' ms'),
			E('td',{'class':'td'},r.health_updated?_('Yes'):_('No')),
			E('td',{'class':'td'},native.text(r.error))
		]);
	});
	return native.table(
		[_('Member'),_('Resolved node'),_('Kind'),_('Transport'),_('IP version'),_('State'),_('Latency'),_('Health updated'),_('Error')],
		rows
	);
}

function waitOperation(operationId, delaySeconds, startedAt, onProgress) {
	return new Promise(function(resolve,reject) {
		if(Date.now()-startedAt>60000) {
			reject(new Error(_('Operation remained nonterminal for more than 60 seconds.')));
			return;
		}
		window.setTimeout(function() {
			dae.callNativeOperationGet(operationId).then(function(raw){
				var parsed=native.parse(raw);
				if(!parsed.ok) {
					reject(new Error(parsed.error));
					return;
				}
				var op=parsed.data||{};
				if(onProgress) onProgress(op);
				if(op.status==='succeeded'||op.status==='failed') {
					resolve(op);
					return;
				}
				waitOperation(operationId,Number(raw.retry_after||1),startedAt,onProgress).then(resolve,reject);
			},reject);
		},Math.max(1,Number(delaySeconds||1))*1000);
	});
}

function renderData(groupsResult,outResult,canProbe,probeHandler) {
	if(!groupsResult||!groupsResult.ok) return native.errorBox(groupsResult);
	var groups=unwrapGroups(groupsResult.data);
	var outbounds=(outResult&&outResult.ok&&outResult.data&&outResult.data.outbounds)||[];
	var byName={};
	outbounds.forEach(function(o){byName[o.name]=o;});
	var rows=groups.map(function(g){
		var use=byName[g.name]||byName[g.id]||{};
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},native.text(g.name||g.id)),
			E('td',{'class':'td'},native.text(policyKind(g))),
			E('td',{'class':'td'},selectText(g,'tcp')),
			E('td',{'class':'td'},selectText(g,'udp')),
			E('td',{'class':'td'},String(memberCount(g))),
			E('td',{'class':'td'},native.text(use.active_connections!==undefined?use.active_connections:(use.active!==undefined?use.active:use.connections))),
			E('td',{'class':'td'},native.humanBytes(use.upload_bytes)),
			E('td',{'class':'td'},native.humanBytes(use.download_bytes)),
			E('td',{'class':'td'},canProbe?E('button',{
				'class':'btn cbi-button cbi-button-action',
				'click':function(){return probeHandler(g);}
			},_('Probe…')):'-')
		]);
	});
	return native.table(
		[_('Policy'),_('Kind'),_('TCP selection'),_('UDP selection'),_('Members'),_('Active'),_('Upload total'),_('Download total'),_('Probe')],
		rows
	);
}

return view.extend({
	load:function(){
		return dae.callNativeApiStatus().then(function(status){
			if(!status.resources||status.resources.groups!==true) return {status:status,groups:null,outbounds:null};
			var groupP=dae.callNativeApiGet('groups').then(native.parse);
			var outP=status.resources.runtime_outbounds===true?dae.callNativeApiGet('runtime_outbounds').then(native.parse):Promise.resolve(null);
			return Promise.all([groupP,outP]).then(function(v){return {status:status,groups:v[0],outbounds:v[1]};});
		});
	},

	refresh:function(){
		return Promise.all([
			dae.callNativeApiGet('groups').then(native.parse),
			this.hasOutbounds?dae.callNativeApiGet('runtime_outbounds').then(native.parse):Promise.resolve(null)
		]).then(function(v){
			var box=document.getElementById('native-policies');
			if(box) dom.content(box,renderData(v[0],v[1],this.canProbe,this.probeGroup.bind(this)));
		}.bind(this));
	},

	probeGroup:function(summary) {
		return dae.callNativeGroupGet(String(summary.id)).then(function(raw){
			var parsed=native.parse(raw);
			if(!parsed.ok) {
				dae.notify(parsed.error,'error');
				return;
			}
			this.openGroupProbe(parsed.data||{});
		}.bind(this));
	},

	openGroupProbe:function(group) {
		var p=this.probeOptions||{};
		var kinds=(p.kinds||[]).filter(function(k){return ['tcp_connect','http','dns'].indexOf(k)>=0;});
		var ips=ipChoices(p);
		var members=group.members||[];
		if(!kinds.length||!ips.length||!members.length) {
			dae.notify(_('This group has no usable advertised probe combination or no direct members.'),'warning');
			return;
		}

		var kind=E('select',{'class':'cbi-input-select'},kinds.map(function(k){return E('option',{'value':k},k);}));
		var transport=E('select',{'class':'cbi-input-select'});
		var ip=E('select',{'class':'cbi-input-select'},ips.map(function(v){return E('option',{'value':v},v);}));
		var warmth=E('select',{'class':'cbi-input-select'},[
			E('option',{'value':'warm'},_('warm')),
			E('option',{'value':'cold'},_('cold'))
		]);
		var preview=E('pre',{'style':'white-space:pre-wrap'});
		var sizing=E('div',{'class':'cbi-map-descr'});

		function batchInfo() {
			var limits=p.limits||{};
			var dimensions=ip.value==='any'?2:1;
			var maxMembers=Number(limits.max_members_per_job||0);
			var maxResults=Number(limits.max_results_per_job||0);
			var size=Math.min(maxMembers,Math.floor(maxResults/Math.max(1,dimensions)));
			return {
				size:size,
				batches:size>0?Math.ceil(members.length/size):0,
				dimensions:dimensions,
				maxMembers:maxMembers,
				maxResults:maxResults
			};
		}

		function rebuild() {
			var ts=transportsFor(p,kind.value,group);
			transport.replaceChildren.apply(transport,ts.map(function(t){return E('option',{'value':t},t);}));
			var bi=batchInfo();
			sizing.textContent=_('Direct members: ')+members.length+
				' · '+_('batch size: ')+(bi.size||0)+
				' · '+_('operations: ')+(bi.batches||0)+
				' · '+_('max members/job: ')+bi.maxMembers+
				' · '+_('max results/job: ')+bi.maxResults;
			preview.textContent=JSON.stringify({
				target:{type:'group',group_id:group.id},
				kind:kind.value,
				purpose:kind.value==='dns'?'dns':'data',
				transport:transport.value?[transport.value]:[],
				ip_version:ip.value,
				members:'batched explicit direct-member IDs',
				warmth:warmth.value
			},null,2);
		}
		[kind,transport,ip,warmth].forEach(function(el){el.addEventListener('change',rebuild);});
		rebuild();

		ui.showModal(_('Probe group: ')+(group.name||group.id),[
			E('div',{'class':'alert-message notice'},_('The group probe is explicit network activity. Direct members are split into bounded jobs using the backend-advertised member/result limits. Jobs run sequentially; no batch is submitted until the previous operation finishes.')),
			E('div',{'class':'cbi-value'},[E('label',{'class':'cbi-value-title'},_('Kind')),E('div',{'class':'cbi-value-field'},kind)]),
			E('div',{'class':'cbi-value'},[E('label',{'class':'cbi-value-title'},_('Transport')),E('div',{'class':'cbi-value-field'},transport)]),
			E('div',{'class':'cbi-value'},[E('label',{'class':'cbi-value-title'},_('IP version')),E('div',{'class':'cbi-value-field'},ip)]),
			E('div',{'class':'cbi-value'},[E('label',{'class':'cbi-value-title'},_('Warmth')),E('div',{'class':'cbi-value-field'},warmth)]),
			sizing,
			E('h4',{},_('Request preview')),
			preview,
			E('div',{'class':'right'},[
				E('button',{'class':'btn','click':ui.hideModal},_('Cancel')),
				' ',
				E('button',{
					'class':'btn cbi-button cbi-button-action',
					'click':ui.createHandlerFn(this,function(){
						var bi=batchInfo();
						if(!transport.value||bi.size<1) {
							dae.notify(_('The advertised probe limits do not allow this group request.'),'error');
							return;
						}
						return this.runGroupBatches(group,{
							kind:kind.value,
							transport:transport.value,
							ip_version:ip.value,
							warmth:warmth.value,
							batch_size:bi.size
						});
					})
				},_('Run group probe'))
			])
		]);
	},

	runGroupBatches:function(group,opts) {
		var members=(group.members||[]).slice();
		var batches=[];
		for(var i=0;i<members.length;i+=opts.batch_size)
			batches.push(members.slice(i,i+opts.batch_size).map(function(m){return String(m.id);}));

		var combined={
			target:{type:'group',group_id:group.id},
			selection_changed:{tcp:false,udp:false},
			selection_before:null,
			selection_after:null,
			results:[]
		};

		var runBatch=function(index) {
			if(index>=batches.length) return Promise.resolve(combined);

			ui.showModal(_('Group Probe'),[
				E('p',{'class':'spinning'},_('Running batch ')+(index+1)+' / '+batches.length+
					' · '+batches[index].length+' '+_('members'))
			]);

			return dae.callNativeProbeStart(
				'group',String(group.id),opts.kind,opts.transport,opts.ip_version,opts.warmth,JSON.stringify(batches[index])
			).then(function(raw){
				var parsed=native.parse(raw);
				if(!parsed.ok) throw new Error(parsed.error);
				var accepted=parsed.data||{};
				if(!accepted.operation_id) throw new Error(_('Probe accepted without operation_id.'));
				return waitOperation(accepted.operation_id,Number(raw.retry_after||1),Date.now(),function(op){
					ui.showModal(_('Group Probe'),[
						E('p',{'class':'spinning'},_('Batch ')+(index+1)+' / '+batches.length+
							' · '+native.text(op.status)+' · '+accepted.operation_id)
					]);
				});
			}).then(function(op){
				if(op.status!=='succeeded') {
					var err=op.error||{};
					throw new Error((err.code?err.code+': ':'')+(err.message||_('Probe operation failed.')));
				}
				var result=op.result||{};
				if(!combined.selection_before) combined.selection_before=result.selection_before||null;
				combined.selection_after=result.selection_after||combined.selection_after;
				combined.selection_changed.tcp=combined.selection_changed.tcp||!!(result.selection_changed&&result.selection_changed.tcp);
				combined.selection_changed.udp=combined.selection_changed.udp||!!(result.selection_changed&&result.selection_changed.udp);
				combined.results=combined.results.concat(result.results||[]);
				return runBatch(index+1);
			});
		};

		return runBatch(0).then(function(result){
			ui.showModal(_('Group Probe'),[
				E('div',{'class':'alert-message success'},[
					_('Completed ')+batches.length+' '+_('bounded probe operations.')+' ',
					_('Selection changed: TCP ')+(result.selection_changed.tcp?_('Yes'):_('No'))+
					' · UDP '+(result.selection_changed.udp?_('Yes'):_('No'))
				]),
				resultTable(result),
				E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
			]);
		}).catch(function(err){
			ui.showModal(_('Group Probe'),[
				E('div',{'class':'alert-message warning'},String(err&&err.message||err)),
				combined.results.length?E('div',{},[
					E('p',{},_('Results completed before the failure: ')+combined.results.length),
					resultTable(combined)
				]):null,
				E('div',{'class':'right'},E('button',{'class':'btn','click':ui.hideModal},_('Close')))
			]);
		});
	},

	render:function(data){
		var status=data.status||{},available=status.resources&&status.resources.groups===true;
		this.hasOutbounds=!!(status.resources&&status.resources.runtime_outbounds===true);
		this.probeOptions=status.probe_options||{};
		this.canProbe=!!(status.resources&&status.resources.probes===true&&status.resources.operations===true&&offered(this.probeOptions.targets,'group'));

		if(available) poll.add(dae.visiblePoll(L.bind(this.refresh,this)), 5);
		return E([],[
			E('h2',{},_('Runtime Policies')),
			E('div',{'class':'cbi-map-descr'},_('Current group selection plus outbound counters when available. Policy selection remains read-only; the only active operation on this page is an explicitly requested bounded group health probe.')),
			this.canProbe?E('div',{'class':'alert-message notice'},_('Group probes use only direct members and automatically split them into sequential jobs that satisfy the backend-advertised member/result limits.')):null,
			E('div',{'id':'native-policies'},available?renderData(data.groups,data.outbounds,this.canProbe,this.probeGroup.bind(this)):native.unavailable(status,'groups'))
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
