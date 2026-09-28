'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';

function humanBytes(v) {
	var n = Number(v || 0);
	if (n < 1024) return n.toFixed(0) + ' B';
	if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
	if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MiB';
	return (n / 1024 / 1024 / 1024).toFixed(2) + ' GiB';
}

function humanRate(v) {
	return humanBytes(v) + '/s';
}

function humanSeconds(v) {
	var n = Math.max(0, Math.floor(Number(v || 0)));
	if (!n) return '-';
	var d = Math.floor(n / 86400); n %= 86400;
	var h = Math.floor(n / 3600); n %= 3600;
	var m = Math.floor(n / 60);
	var s = n % 60;
	var out = [];
	if (d) out.push(d + 'd');
	if (h || d) out.push(h + 'h');
	if (m || h || d) out.push(m + 'm');
	if (!d) out.push(s + 's');
	return out.join(' ');
}

function metric(title, id, value, note) {
	return E('div', {
		'class': 'cbi-section',
		'style': 'display:inline-block;vertical-align:top;min-width:190px;margin:0 10px 10px 0;padding:12px'
	}, [
		E('div', { 'class': 'cbi-map-descr' }, title),
		E('div', { 'id': id, 'style': 'font-size:1.55em;font-weight:700;margin:4px 0' }, value),
		note ? E('div', { 'class': 'cbi-map-descr' }, note) : null
	]);
}

function ifaceTable(name, data) {
	data = data || {};
	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, name),
		E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td left', 'style': 'width:180px;font-weight:600' }, _('Status')),
				E('div', { 'class': 'td left' }, E('span', { 'id': 'rt-' + name + '-state' }, dae.badge(data.present ? _('Present') : _('Missing'), !!data.present)))
			]),
			E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td left', 'style': 'width:180px;font-weight:600' }, _('RX rate')),
				E('div', { 'class': 'td left', 'id': 'rt-' + name + '-rx-rate' }, '-')
			]),
			E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td left', 'style': 'width:180px;font-weight:600' }, _('TX rate')),
				E('div', { 'class': 'td left', 'id': 'rt-' + name + '-tx-rate' }, '-')
			]),
			E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td left', 'style': 'width:180px;font-weight:600' }, _('Cumulative RX / TX')),
				E('div', { 'class': 'td left', 'id': 'rt-' + name + '-total' }, humanBytes(data.rx_bytes) + ' / ' + humanBytes(data.tx_bytes))
			]),
			E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td left', 'style': 'width:180px;font-weight:600' }, _('Packets RX / TX')),
				E('div', { 'class': 'td left', 'id': 'rt-' + name + '-packets' }, String(data.rx_packets || 0) + ' / ' + String(data.tx_packets || 0))
			])
		])
	]);
}

function capState(native, key) {
	var r = (native && native.resources) || {};
	if (r[key] === true) return { text: _('Available'), state: true };
	if (r[key] === false) return { text: _('Unavailable'), state: false };
	if (native && native.capabilities_status === 401) return { text: _('Auth required'), state: 'WARN' };
	if (native && native.contract_ready) return { text: _('Not reported'), state: 'WARN' };
	return { text: _('Requires Native API'), state: false };
}

function capabilityRow(title, source, state) {
	return E('div', { 'class': 'tr' }, [
		E('div', { 'class': 'td left', 'style': 'width:260px;font-weight:600' }, title),
		E('div', { 'class': 'td left', 'style': 'width:160px' }, source),
		E('div', { 'class': 'td left' }, dae.badge(state.text, state.state))
	]);
}

return view.extend({
	load: function() {
		return Promise.all([ dae.callRuntimeStats(), dae.callNativeApiStatus() ]);
	},

	updateRuntime: function(next) {
		var prev = this.prev;
		var dt = prev ? Number(next.timestamp || 0) - Number(prev.timestamp || 0) : 0;
		if (dt <= 0) dt = 2;

		var cpu = 0;
		if (prev && next.running && prev.running && next.pid === prev.pid) {
			var tickDelta = Number(next.cpu_ticks || 0) - Number(prev.cpu_ticks || 0);
			var hz = Number(next.clock_ticks || 100) || 100;
			cpu = Math.max(0, tickDelta / hz / dt * 100);
		}

		function rate(curValue, oldValue, curPresent, oldPresent) {
			if (!prev || !curPresent || !oldPresent) return 0;
			var d = Number(curValue || 0) - Number(oldValue || 0);
			return d > 0 ? d / dt : 0;
		}

		var vals = {
			'rt-service': next.running ? _('Running') : _('Stopped'),
			'rt-memory': dae.bytesFromKiB(next.memory_kb),
			'rt-cpu': cpu.toFixed(1) + '%',
			'rt-uptime': humanSeconds(next.process_uptime),
			'rt-socket-fds': String(next.socket_fds || 0),
			'rt-ss-sockets': next.ss_available ? String(next.ss_process_sockets || 0) : _('ss unavailable')
		};
		Object.keys(vals).forEach(function(id) {
			var el = document.getElementById(id);
			if (el) el.textContent = vals[id];
		});

		[ 'dae0', 'dae0peer' ].forEach(function(name) {
			var cur = next[name] || {};
			var old = prev ? (prev[name] || {}) : {};
			var st = document.getElementById('rt-' + name + '-state');
			if (st) dom.content(st, dae.badge(cur.present ? _('Present') : _('Missing'), !!cur.present));
			var rx = document.getElementById('rt-' + name + '-rx-rate');
			if (rx) rx.textContent = humanRate(rate(cur.rx_bytes, old.rx_bytes, cur.present, old.present));
			var tx = document.getElementById('rt-' + name + '-tx-rate');
			if (tx) tx.textContent = humanRate(rate(cur.tx_bytes, old.tx_bytes, cur.present, old.present));
			var total = document.getElementById('rt-' + name + '-total');
			if (total) total.textContent = humanBytes(cur.rx_bytes) + ' / ' + humanBytes(cur.tx_bytes);
			var pk = document.getElementById('rt-' + name + '-packets');
			if (pk) pk.textContent = String(cur.rx_packets || 0) + ' / ' + String(cur.tx_packets || 0);
		});

		this.prev = next;
	},

	render: function(data) {
		var initial = data[0] || {};
		var native = data[1] || {};
		this.prev = initial;

		poll.add(L.bind(function() {
			return dae.callRuntimeStats().then(this.updateRuntime.bind(this));
		}, this), 2);

		var connections = capState(native, 'connections');
		var probes = capState(native, 'probes');
		var outbounds = capState(native, 'runtime_outbounds');
		var flows = capState(native, 'flows');
		var trace = capState(native, 'routing_trace');
		var dnsCache = capState(native, 'dns_cache');
		var dnsLog = capState(native, 'dns_log');

		return E([], [
			E('h2', {}, _('DAE Runtime')),
			E('div', { 'class': 'cbi-map-descr' }, _('Local metrics come from /proc, /sys/class/net and ss when available. Interface counters are kernel-interface counters, not a substitute for Native API proxy accounting.')),
			E('div', {}, [
				metric(_('Service'), 'rt-service', initial.running ? _('Running') : _('Stopped'), _('Local process state')),
				metric(_('Memory'), 'rt-memory', dae.bytesFromKiB(initial.memory_kb), _('RSS')),
				metric(_('CPU'), 'rt-cpu', '0.0%', _('Calculated from process CPU ticks between polls')),
				metric(_('Uptime'), 'rt-uptime', humanSeconds(initial.process_uptime), _('Current dae process')),
				metric(_('Socket FDs'), 'rt-socket-fds', String(initial.socket_fds || 0), _('All socket descriptors owned by dae')),
				metric(_('ss process sockets'), 'rt-ss-sockets', initial.ss_available ? String(initial.ss_process_sockets || 0) : _('ss unavailable'), _('Best-effort process-owned socket count'))
			]),
			E('h3', {}, _('eBPF interface counters')),
			ifaceTable('dae0', initial.dae0),
			ifaceTable('dae0peer', initial.dae0peer),
			E('h3', {}, _('Runtime capability matrix')),
			E('div', { 'class': 'table' }, [
				capabilityRow(_('Process / memory metrics'), _('Local'), { text: _('Available'), state: true }),
				capabilityRow(_('Interface traffic counters'), _('Local'), { text: initial.dae0 && initial.dae0.present ? _('Available') : _('dae0 missing'), state: initial.dae0 && initial.dae0.present }),
				capabilityRow(_('Socket descriptor count'), _('Local'), { text: initial.running ? _('Available') : _('Process stopped'), state: !!initial.running }),
				capabilityRow(_('Detailed connections'), _('Native API'), connections),
				capabilityRow(_('Node health / latency probes'), _('Native API'), probes),
				capabilityRow(_('Runtime policy / outbound selection'), _('Native API'), outbounds),
				capabilityRow(_('Flow history'), _('Native API'), flows),
				capabilityRow(_('Routing trace'), _('Native API'), trace),
				capabilityRow(_('DNS cache telemetry'), _('Native API'), dnsCache),
				capabilityRow(_('DNS query log telemetry'), _('Native API'), dnsLog)
			]),
			E('div', { 'class': native.contract_ready ? 'alert-message success' : 'alert-message notice' },
				native.contract_ready
					? _('A compatible Native API discovery endpoint was detected. Resource availability above comes from /api/v1/capabilities when that endpoint is publicly readable.')
					: _('No compatible Native API discovery response is currently available. Native-only rows remain disabled rather than showing inferred or fabricated runtime data.'))
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
