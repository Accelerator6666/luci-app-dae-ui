'use strict';
'require view';
'require poll';
'require dom';
'require daeui.common as dae';
'require daeui.native as nativeApi';

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

function resourceButton(title, path, available) {
	if (!available) return null;
	return E('a', {
		'class': 'btn cbi-button cbi-button-action',
		'href': L.url('admin/services/dae-ui/' + path),
		'style': 'margin:0 8px 8px 0'
	}, title);
}

function trafficPanel(title, id, note) {
	return E('div', {
		'class':'cbi-section',
		'style':'display:inline-block;vertical-align:top;width:min(760px,100%);margin:0 10px 10px 0;padding:12px'
	}, [
		E('h4', { 'style':'margin:0 0 4px' }, title),
		E('div', { 'class':'cbi-map-descr', 'id':id + '-summary' }, _('Waiting for samples…')),
		E('canvas', {
			'id':id + '-canvas',
			'width':'720',
			'height':'170',
			'style':'display:block;width:100%;height:170px;margin-top:8px'
		}),
		E('div', { 'class':'cbi-map-descr', 'style':'display:flex;gap:14px;flex-wrap:wrap;margin-top:6px' }, [
			E('span', {}, [ E('strong', {}, 'RX'), ' · ', _('download direction on dae0') ]),
			E('span', {}, [ E('strong', {}, 'TX'), ' · ', _('upload direction on dae0') ]),
			note ? E('span', {}, note) : null
		])
	]);
}

function trafficWindow(history, horizon, now) {
	var cutoff = Number(now || 0) - Number(horizon || 0);
	return (history || []).filter(function(sample) {
		return Number(sample.ts || 0) >= cutoff;
	});
}

function trafficStats(samples) {
	if (!samples.length) return { rxAvg:0, txAvg:0, rxPeak:0, txPeak:0, rxNow:0, txNow:0 };
	var rx=0, tx=0, rxPeak=0, txPeak=0;
	samples.forEach(function(sample) {
		var r=Number(sample.rx || 0), t=Number(sample.tx || 0);
		rx += r; tx += t;
		if (r > rxPeak) rxPeak = r;
		if (t > txPeak) txPeak = t;
	});
	var last=samples[samples.length-1] || {};
	return {
		rxAvg:rx/samples.length,
		txAvg:tx/samples.length,
		rxPeak:rxPeak,
		txPeak:txPeak,
		rxNow:Number(last.rx || 0),
		txNow:Number(last.tx || 0)
	};
}

function drawTraffic(id, history, horizon, now) {
	var canvas=document.getElementById(id + '-canvas');
	var summary=document.getElementById(id + '-summary');
	if (!canvas || !summary) return;

	var samples=trafficWindow(history,horizon,now);
	if (!samples.length) {
		summary.textContent=_('Waiting for samples…');
		return;
	}

	var stats=trafficStats(samples);
	summary.textContent=
		_('Now RX ') + humanRate(stats.rxNow) + ' · ' + _('TX ') + humanRate(stats.txNow) +
		' · ' + _('Avg RX ') + humanRate(stats.rxAvg) + ' · ' + _('TX ') + humanRate(stats.txAvg) +
		' · ' + _('Peak RX ') + humanRate(stats.rxPeak) + ' · ' + _('TX ') + humanRate(stats.txPeak);

	var rect=canvas.getBoundingClientRect();
	var cssWidth=Math.max(320,Math.floor(rect.width || 720));
	var cssHeight=170;
	var ratio=Math.max(1,Math.min(2,window.devicePixelRatio || 1));
	if (canvas.width !== Math.floor(cssWidth*ratio) || canvas.height !== Math.floor(cssHeight*ratio)) {
		canvas.width=Math.floor(cssWidth*ratio);
		canvas.height=Math.floor(cssHeight*ratio);
	}
	var ctx=canvas.getContext('2d');
	if (!ctx) return;
	ctx.setTransform(ratio,0,0,ratio,0,0);
	ctx.clearRect(0,0,cssWidth,cssHeight);

	var styles=window.getComputedStyle(document.documentElement);
	var grid=styles.getPropertyValue('--border-color-medium') || 'rgba(127,127,127,.22)';
	var rxColor=styles.getPropertyValue('--primary-color-medium') || styles.getPropertyValue('--primary-color') || '#2563eb';
	var txColor=styles.getPropertyValue('--warning-color-medium') || '#d97706';
	var textColor=styles.getPropertyValue('--text-color-medium') || styles.getPropertyValue('--text-color') || '#666';
	var pad={ left:58, right:10, top:10, bottom:24 };
	var w=cssWidth-pad.left-pad.right;
	var h=cssHeight-pad.top-pad.bottom;
	var max=1;
	samples.forEach(function(sample) {
		max=Math.max(max,Number(sample.rx||0),Number(sample.tx||0));
	});

	ctx.strokeStyle=grid.trim() || 'rgba(127,127,127,.22)';
	ctx.lineWidth=1;
	for (var g=0; g<=4; g++) {
		var gy=pad.top+h*g/4;
		ctx.beginPath();
		ctx.moveTo(pad.left,gy);
		ctx.lineTo(pad.left+w,gy);
		ctx.stroke();
	}

	ctx.fillStyle=textColor.trim() || '#666';
	ctx.font='11px sans-serif';
	ctx.textAlign='right';
	ctx.fillText(humanRate(max),pad.left-6,pad.top+4);
	ctx.fillText('0 B/s',pad.left-6,pad.top+h+4);
	ctx.textAlign='left';
	ctx.fillText('-'+horizon+'s',pad.left,pad.top+h+18);
	ctx.textAlign='right';
	ctx.fillText(_('now'),pad.left+w,pad.top+h+18);

	function line(key,color) {
		ctx.strokeStyle=color.trim() || color;
		ctx.lineWidth=2;
		ctx.beginPath();
		samples.forEach(function(sample,index) {
			var age=Math.max(0,Number(now||0)-Number(sample.ts||0));
			var x=pad.left+w*(1-Math.min(horizon,age)/horizon);
			var y=pad.top+h*(1-Math.min(max,Number(sample[key]||0))/max);
			if(index===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
		});
		ctx.stroke();
	}
	line('rx',rxColor);
	line('tx',txColor);
}

function nativeGeneration(parsed) {
	if (!parsed || !parsed.ok || !parsed.data) return '';
	var value = parsed.data.generation_id;
	return value === null || value === undefined ? '' : String(value);
}

function generationSummary(configResource, rulesResource, dnsRulesResource) {
	var entries = [
		{ key:'config', title:_('Config generation'), value:nativeGeneration(configResource) },
		{ key:'rules', title:_('Traffic rules generation'), value:nativeGeneration(rulesResource) },
		{ key:'dns_rules', title:_('DNS rules generation'), value:nativeGeneration(dnsRulesResource) }
	];
	var ids = [];
	var reported = 0;
	entries.forEach(function(entry) {
		if (!entry.value) return;
		reported++;
		if (ids.indexOf(entry.value) < 0) ids.push(entry.value);
	});
	return {
		entries: entries,
		ids: ids,
		reported: reported,
		state: reported === 0
			? { text:_('Not reported'), state:'WARN' }
			: reported === 1
				? { text:_('Only one generation reported'), state:'WARN' }
				: ids.length === 1
					? { text:_('Consistent'), state:true }
					: { text:_('Mismatch'), state:false }
	};
}

function generationTable(summary, status) {
	var resources = (status && status.resources) || {};
	var rows = summary.entries.filter(function(entry) {
		return resources[entry.key] === true;
	}).map(function(entry) {
		return E('div', { 'class':'tr' }, [
			E('div', { 'class':'td left', 'style':'width:260px;font-weight:600' }, entry.title),
			E('div', { 'class':'td left' }, entry.value ? E('code', {}, entry.value) : _('Not reported'))
		]);
	});
	rows.push(E('div', { 'class':'tr' }, [
		E('div', { 'class':'td left', 'style':'width:260px;font-weight:600' }, _('Consistency')),
		E('div', { 'class':'td left' }, dae.badge(summary.state.text, summary.state.state))
	]));
	return E('div', { 'class':'table' }, rows);
}

return view.extend({
	load: function() {
		return Promise.all([ dae.callRuntimeStats(), dae.callNativeApiStatus() ]).then(function(base) {
			var status = base[1] || {};
			var resources = status.resources || {};
			function loadResource(name) {
				if (resources[name] !== true) return Promise.resolve(null);
				return dae.callNativeApiGet(name).then(nativeApi.parse);
			}
			return Promise.all([
				Promise.resolve(base[0] || {}),
				Promise.resolve(status),
				loadResource('config'),
				loadResource('rules'),
				loadResource('dns_rules')
			]);
		});
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

		var trafficSample = null;
		[ 'dae0', 'dae0peer' ].forEach(function(name) {
			var cur = next[name] || {};
			var old = prev ? (prev[name] || {}) : {};
			var rxRate = rate(cur.rx_bytes, old.rx_bytes, cur.present, old.present);
			var txRate = rate(cur.tx_bytes, old.tx_bytes, cur.present, old.present);
			var st = document.getElementById('rt-' + name + '-state');
			if (st) dom.content(st, dae.badge(cur.present ? _('Present') : _('Missing'), !!cur.present));
			var rx = document.getElementById('rt-' + name + '-rx-rate');
			if (rx) rx.textContent = humanRate(rxRate);
			var tx = document.getElementById('rt-' + name + '-tx-rate');
			if (tx) tx.textContent = humanRate(txRate);
			var total = document.getElementById('rt-' + name + '-total');
			if (total) total.textContent = humanBytes(cur.rx_bytes) + ' / ' + humanBytes(cur.tx_bytes);
			var pk = document.getElementById('rt-' + name + '-packets');
			if (pk) pk.textContent = String(cur.rx_packets || 0) + ' / ' + String(cur.tx_packets || 0);
			if (name === 'dae0' && cur.present)
				trafficSample = { ts:Number(next.timestamp || 0), rx:rxRate, tx:txRate };
		});

		if (trafficSample && trafficSample.ts > 0) {
			this.trafficHistory = (this.trafficHistory || []).filter(function(sample) {
				return sample.ts >= trafficSample.ts - 300;
			});
			this.trafficHistory.push(trafficSample);
			drawTraffic('rt-traffic-60', this.trafficHistory, 60, trafficSample.ts);
			drawTraffic('rt-traffic-300', this.trafficHistory, 300, trafficSample.ts);
		}

		this.prev = next;
	},

	render: function(data) {
		var initial = data[0] || {};
		var native = data[1] || {};
		var configGeneration = data[2] || null;
		var rulesGeneration = data[3] || null;
		var dnsRulesGeneration = data[4] || null;
		var generations = generationSummary(configGeneration, rulesGeneration, dnsRulesGeneration);
		this.prev = initial;
		this.trafficHistory = [];

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
		var dnsQuery = capState(native, 'dns_query');
		var rules = capState(native, 'rules');
		var dnsRules = capState(native, 'dns_rules');

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
			E('h3', {}, _('Live dae0 traffic trend')),
			E('div', { 'class':'cbi-map-descr' }, _('The charts are calculated locally from dae0 kernel byte counters every 2 seconds. History starts when this Runtime page is opened and is not persisted.')),
			E('div', {}, [
				trafficPanel(_('Last 60 seconds'), 'rt-traffic-60', _('High-resolution short window')),
				trafficPanel(_('Last 5 minutes'), 'rt-traffic-300', _('Rolling in-page history'))
			]),
			E('h3', {}, _('Native generation consistency')),
			E('div', { 'class':'cbi-map-descr' }, _('Read-only consistency check across Native API config, traffic-rule and DNS-rule dictionaries. A single reported generation means these runtime dictionaries agree. This does not infer desired-vs-active state when the backend does not report it.')),
			generationTable(generations, native),
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
				capabilityRow(_('DNS query log telemetry'), _('Native API'), dnsLog),
				capabilityRow(_('Diagnostic DNS query'), _('Native API'), dnsQuery),
				capabilityRow(_('Routing rule dictionary'), _('Native API'), rules),
				capabilityRow(_('DNS rule dictionary'), _('Native API'), dnsRules)
			]),
			E('h3', {}, _('Native runtime pages')),
			E('div', {}, [
				resourceButton(_('Connections'), 'connections', native.resources && native.resources.connections === true),
				resourceButton(_('Nodes & Latency'), 'native-nodes', native.resources && native.resources.nodes === true),
				resourceButton(_('Runtime Policies'), 'runtime-policies', native.resources && native.resources.groups === true),
				resourceButton(_('Flows'), 'flows', native.resources && native.resources.flows === true),
				resourceButton(_('DNS Runtime'), 'dns-runtime', native.resources && (native.resources.dns_cache === true || native.resources.dns_log === true)),
				resourceButton(_('Native Diagnostics'), 'native-tools', native.resources && (native.resources.routing_trace === true || native.resources.dns_query === true)),
				resourceButton(_('Native Rules'), 'native-rules', native.resources && native.resources.rules === true),
				resourceButton(_('Native DNS Rules'), 'native-dns-rules', native.resources && native.resources.dns_rules === true)
			].filter(Boolean)),
			!(native.resources && (
				native.resources.connections === true ||
				native.resources.nodes === true ||
				native.resources.groups === true ||
				native.resources.flows === true ||
				native.resources.dns_cache === true ||
				native.resources.dns_log === true ||
				native.resources.routing_trace === true ||
				native.resources.dns_query === true ||
				native.resources.rules === true ||
				native.resources.dns_rules === true
			)) ? E('div', { 'class':'alert-message notice' }, _('No read-only Native API runtime page is currently available.')) : null,
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
