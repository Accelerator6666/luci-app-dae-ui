'use strict';
'require view';
'require poll';
'require ui';
'require daeui.common as dae';
'require daeui.native as native';

function latency(node, transport) {
	var best = null;
	(node.health || []).forEach(function(h) {
		if (h.transport !== transport || h.latency_ms === null || h.latency_ms === undefined) return;
		var n = Number(h.latency_ms);
		if (Number.isFinite(n) && (best === null || n < best)) best = n;
	});
	return best;
}

function probeResultNode(op) {
	op = op || {};
	if (op.status === 'failed') {
		var err = op.error || {};
		return E('div', { 'class':'alert-message warning' }, [
			E('strong', {}, _('Probe failed. ')),
			err.code ? E('code', {}, err.code) : null,
			err.message ? ' · ' + err.message : ''
		]);
	}

	var result = op.result || {};
	var rows = (result.results || []).map(function(r) {
		return E('tr', { 'class':'tr' }, [
			E('td', { 'class':'td' }, native.text(r.member_id)),
			E('td', { 'class':'td' }, native.text(r.resolved_leaf_node_id)),
			E('td', { 'class':'td' }, native.text(r.transport)),
			E('td', { 'class':'td' }, native.text(r.ip_version)),
			E('td', { 'class':'td' }, native.text(r.state)),
			E('td', { 'class':'td' }, r.latency_ms === null || r.latency_ms === undefined ? '-' : String(r.latency_ms) + ' ms'),
			E('td', { 'class':'td' }, r.health_updated ? _('Yes') : _('No')),
			E('td', { 'class':'td' }, native.text(r.error))
		]);
	});

	return E([], [
		E('div', { 'class':'alert-message success' }, [
			_('Probe completed. TCP selection changed: '),
			result.selection_changed && result.selection_changed.tcp ? _('Yes') : _('No')
		]),
		native.table(
			[ _('Member'), _('Resolved node'), _('Transport'), _('IP version'), _('State'), _('Latency'), _('Health updated'), _('Error') ],
			rows
		)
	]);
}

function buildGrid(rows, canProbe, probeHandler) {
	return native.dataGrid(rows, {
		searchPlaceholder: _('Search node, protocol, provider or group…'),
		pageSize: 50,
		filters: [
			{ key:'protocol', title:_('protocol'), value:function(n){ return native.text(n.protocol, ''); } },
			{ key:'provider', title:_('provider'), value:function(n){ return native.text(n.provider_id || n.subscription_tag, ''); } }
		],
		search: function(n) {
			return [
				n.id, n.name, n.protocol, n.provider_id, n.subscription_tag,
				native.text(n.group_ids, '')
			].join(' ');
		},
		columns: [
			{ key:'name', title:_('Node'), value:function(n){ return native.text(n.name || n.id, ''); } },
			{ key:'protocol', title:_('Protocol'), value:function(n){ return native.text(n.protocol, ''); } },
			{ key:'provider', title:_('Provider'), value:function(n){ return native.text(n.provider_id || n.subscription_tag, ''); } },
			{ key:'groups', title:_('Groups'), value:function(n){ return native.text(n.group_ids, ''); } },
			{ key:'tcp', title:_('TCP latency'), numeric:true, value:function(n){ var v=latency(n,'tcp'); return v === null ? 1e15 : v; }, render:function(n){ var v=latency(n,'tcp'); return v === null ? '-' : v.toFixed(0)+' ms'; } },
			{ key:'udp', title:_('UDP latency'), numeric:true, value:function(n){ var v=latency(n,'udp'); return v === null ? 1e15 : v; }, render:function(n){ var v=latency(n,'udp'); return v === null ? '-' : v.toFixed(0)+' ms'; } },
			{ key:'probe', title:_('Probe'), sortable:false, value:function(){ return ''; }, render:function(n) {
				if (!canProbe) return '-';
				return E('button', {
					'class':'btn cbi-button cbi-button-action',
					'click':function() { return probeHandler(n); }
				}, _('TCP Probe'));
			} }
		]
	});
}

function meta(data, loaded) {
	data = data || {};
	var total = data.total !== undefined ? data.total : loaded;
	return _('Loaded: ') + loaded + ' · ' + _('Total: ') + total;
}

return view.extend({
	load:function() {
		return native.loadResource('nodes', { limit:200 });
	},

	refresh:function() {
		if (this.loader && this.loader.frozen()) return Promise.resolve();
		return dae.callNativeApiGet('nodes', { limit:200 }).then(function(res) {
			var parsed = native.parse(res);
			if (!parsed.ok) return;
			if (this.loader) this.loader.replaceLive(parsed.data || {});
		}.bind(this));
	},

	pollOperation:function(operationId, delaySeconds, startedAt) {
		var elapsed = Date.now() - startedAt;
		if (elapsed > 60000) {
			ui.showModal(_('Node Probe'), [
				E('div', { 'class':'alert-message warning' }, _('The probe operation is still nonterminal after 60 seconds. You can close this dialog; no automatic retry will continue in the background.')),
				E('div', { 'class':'right' }, E('button', { 'class':'btn', 'click':ui.hideModal }, _('Close')))
			]);
			return;
		}

		window.setTimeout(function() {
			dae.callNativeOperationGet(operationId).then(function(raw) {
				var parsed = native.parse(raw);
				if (!parsed.ok) {
					ui.showModal(_('Node Probe'), [
						native.errorBox(parsed),
						E('div', { 'class':'right' }, E('button', { 'class':'btn', 'click':ui.hideModal }, _('Close')))
					]);
					return;
				}

				var op = parsed.data || {};
				if (op.status === 'succeeded' || op.status === 'failed') {
					ui.showModal(_('Node Probe'), [
						probeResultNode(op),
						E('details', {}, [
							E('summary', {}, _('Raw operation')),
							E('pre', { 'style':'white-space:pre-wrap;max-height:360px;overflow:auto' }, JSON.stringify(op, null, 2))
						]),
						E('div', { 'class':'right' }, E('button', { 'class':'btn', 'click':ui.hideModal }, _('Close')))
					]);
					return;
				}

				ui.showModal(_('Node Probe'), [
					E('p', { 'class':'spinning' }, _('Probe is ') + native.text(op.status) + ' · ' + native.text(operationId))
				]);
				this.pollOperation(operationId, Number(raw.retry_after || 1), startedAt);
			}.bind(this));
		}.bind(this), Math.max(1, Number(delaySeconds || 1)) * 1000);
	},

	probeNode:function(node) {
		var id = node && node.id ? String(node.id) : '';
		if (!id) {
			dae.notify(_('This node has no Native API node ID.'), 'error');
			return;
		}

		if (!window.confirm(_('Run one explicit TCP connect probe for this node? This performs network activity and may update backend health observations.')))
			return;

		ui.showModal(_('Node Probe'), [
			E('p', { 'class':'spinning' }, _('Submitting one TCP connect probe for ') + (node.name || id) + '…')
		]);

		return dae.callNativeProbeStart(id).then(function(raw) {
			var parsed = native.parse(raw);
			if (!parsed.ok) {
				ui.showModal(_('Node Probe'), [
					native.errorBox(parsed),
					E('div', { 'class':'right' }, E('button', { 'class':'btn', 'click':ui.hideModal }, _('Close')))
				]);
				return;
			}

			var accepted = parsed.data || {};
			var operationId = accepted.operation_id || '';
			if (!operationId) {
				ui.showModal(_('Node Probe'), [
					E('div', { 'class':'alert-message warning' }, _('The backend accepted the probe but did not return an operation_id.')),
					E('pre', { 'style':'white-space:pre-wrap' }, JSON.stringify(accepted, null, 2)),
					E('div', { 'class':'right' }, E('button', { 'class':'btn', 'click':ui.hideModal }, _('Close')))
				]);
				return;
			}

			ui.showModal(_('Node Probe'), [
				E('p', { 'class':'spinning' }, _('Probe queued · ') + operationId)
			]);
			this.pollOperation(operationId, Number(raw.retry_after || 1), Date.now());
		}.bind(this));
	},

	render:function(data) {
		var status = data.status || {};
		var available = status.resources && status.resources.nodes === true;
		var canProbe = !!(status.resources &&
			status.resources.probes === true &&
			status.resources.operations === true);

		if (!available)
			return E([], [ E('h2',{},_('Native Nodes & Latency')), native.unavailable(status,'nodes') ]);

		if (!data.resource || !data.resource.ok)
			return E([], [ E('h2',{},_('Native Nodes & Latency')), native.errorBox(data.resource) ]);

		var initial = data.resource.data || {};
		this.grid = buildGrid(initial.nodes || [], canProbe, this.probeNode.bind(this));
		var info = E('div', { 'id':'native-nodes-meta', 'class':'cbi-map-descr' }, meta(initial, (initial.nodes || []).length));
		this.loader = native.cursorLoader('nodes', initial, {
			grid:this.grid,
			rowsKey:'nodes',
			query:{ limit:200 },
			maxRows:5000,
			onData:function(page, rows) { info.textContent = meta(page, rows.length); }
		});

		poll.add(L.bind(this.refresh,this),10);

		return E([],[
			E('h2',{},_('Native Nodes & Latency')),
			E('div',{'class':'cbi-map-descr'},_('Read-only node inventory and backend probe observations. The first server page stays live; loading another cursor page freezes that snapshot so sorting and filtering never mix generations.')),
			canProbe
				? E('div',{'class':'alert-message notice'},_('TCP Probe is never automatic. Each probe requires an explicit click and confirmation, then polls only the returned operation ID until it reaches a terminal state or 60 seconds elapse.'))
				: E('div',{'class':'alert-message notice'},_('Explicit node probing is hidden unless both probes and operations are reported available by the Native API.')),
			info,
			this.loader.node,
			this.grid.node
		]);
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
