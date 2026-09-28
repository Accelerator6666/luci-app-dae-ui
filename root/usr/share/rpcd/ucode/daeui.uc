#!/usr/bin/ucode
'use strict';

import { readfile, writefile, popen, stat } from 'fs';
import { cursor } from 'uci';

function settings() {
	let u = cursor();
	if (u) u.load('dae-ui');
	return {
		binary: (u && u.get('dae-ui', 'main', 'binary')) || '/usr/bin/dae',
		init: (u && u.get('dae-ui', 'main', 'init')) || '/etc/init.d/dae',
		config: (u && u.get('dae-ui', 'main', 'config_file')) || '/etc/dae/config.dae',
		log: (u && u.get('dae-ui', 'main', 'log_file')) || '/var/log/dae/dae.log',
		dashboard: (u && u.get('dae-ui', 'main', 'dashboard_dir')) || '/usr/share/dae-ui/dashboard'
	};
}

function shell_quote(s) {
	return "'" + replace(s || '', /'/g, "'\\''") + "'";
}

function run(cmd) {
	let p = popen(cmd + ' 2>&1');
	let out = p ? p.read('all') : '';
	let rc = p ? p.close() : 1;
	return { rc: rc || 0, output: out || '' };
}

function dirname(path) {
	let d = replace(path || '', /\/[^\/]*$/, '');
	return d || '/';
}

function pid() {
	let r = run('pidof dae');
	let m = match(r.output, /([0-9]+)/);
	return m ? +m[1] : 0;
}

function mem_kb(p) {
	if (!p) return 0;
	let s = readfile('/proc/' + p + '/status') || '';
	let m = match(s, /VmRSS:\s+([0-9]+)\s+kB/);
	return m ? +m[1] : 0;
}

function iface_exists(name) {
	return !!stat('/sys/class/net/' + name);
}

function read_num(path) {
	let v = trim(readfile(path) || '');
	return match(v, /^[0-9]+$/) ? +v : 0;
}

function version(bin) {
	let r = run(shell_quote(bin) + ' --version');
	if (!trim(r.output)) r = run(shell_quote(bin) + ' version');
	return trim(split(r.output || '', '\n')[0] || '');
}

function validate(bin, cfg) {
	return run(shell_quote(bin) + ' validate -c ' + shell_quote(cfg));
}

function stamp() {
	return trim(run('date +%Y%m%d-%H%M%S').output);
}

function now_epoch() {
	let v = trim(run('date +%s').output);
	return match(v, /^[0-9]+$/) ? +v : 0;
}

function latest_backup(path) {
	let r = run("ls -1t " + shell_quote(path + '.backup.*') + " 2>/dev/null | head -1");
	return trim(r.output);
}

function backup(path) {
	if (!stat(path)) return '';
	let dst = path + '.backup.' + stamp();
	let r = run('cp -p ' + shell_quote(path) + ' ' + shell_quote(dst));
	return r.rc == 0 ? dst : '';
}

function write_atomic(path, content) {
	let tmp = path + '.new.' + pid() + '.' + stamp();
	if (!writefile(tmp, content)) return { ok: false, error: 'Unable to write temporary file' };
	let r = run('chmod 600 ' + shell_quote(tmp) + ' && mv -f ' + shell_quote(tmp) + ' ' + shell_quote(path));
	return r.rc == 0 ? { ok: true } : { ok: false, error: r.output || 'Unable to replace file' };
}

function config_base(s) {
	return dirname(s.config);
}

function safe_relative(rel) {
	if (!rel || substr(rel, 0, 1) == '/' || match(rel, /(^|\/)\.\.(\/|$)/) || match(rel, /\/\//))
		return false;
	return !!match(rel, /^[A-Za-z0-9._\/-]+\.dae$/);
}

function resolve_config_file(s, rel, must_exist) {
	if (!safe_relative(rel)) return null;
	let base = config_base(s);
	let path = base + '/' + rel;
	if (must_exist && !stat(path)) return null;
	let dir = dirname(path);
	let canon_dir = trim(run('readlink -f ' + shell_quote(dir)).output);
	let canon_base = trim(run('readlink -f ' + shell_quote(base)).output);
	if (!canon_dir || !canon_base) return null;
	if (canon_dir != canon_base && substr(canon_dir, 0, length(canon_base) + 1) != canon_base + '/')
		return null;
	return path;
}

function config_files(s) {
	let base = config_base(s);
	let r = run('find ' + shell_quote(base) + " -maxdepth 3 -type f -name '*.dae' 2>/dev/null | sort");
	let out = [];
	for (let idx, line in split(trim(r.output), '\n')) {
		if (!line) continue;
		let rel = substr(line, length(base) + 1);
		if (!safe_relative(rel)) continue;
		let st = stat(line);
		push(out, {
			path: rel,
			full_path: line,
			main: line == s.config,
			size: st ? (st.size || 0) : 0
		});
	}
	return out;
}

function section_extract(content, source) {
	let names = { global: true, subscription: true, node: true, group: true, routing: true, dns: true, experimental: true };
	let lines = split(content || '', '\n');
	let out = [];
	let active = null;
	let buf = [];
	let depth = 0;

	for (let i = 0; i < length(lines); i++) {
		let line = lines[i];
		if (!active) {
			let m = match(line, /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*\{/);
			if (m && names[m[1]]) {
				active = m[1];
				buf = [ line ];
				depth = 0;
				for (let j = 0; j < length(line); j++) {
					let ch = substr(line, j, 1);
					if (ch == '{') depth++;
					else if (ch == '}') depth--;
				}
				if (depth <= 0) {
					push(out, { name: active, source: source, content: join('\n', buf) });
					active = null;
					buf = [];
				}
			}
		} else {
			push(buf, line);
			for (let j = 0; j < length(line); j++) {
				let ch = substr(line, j, 1);
				if (ch == '{') depth++;
				else if (ch == '}') depth--;
			}
			if (depth <= 0) {
				push(out, { name: active, source: source, content: join('\n', buf) });
				active = null;
				buf = [];
			}
		}
	}
	return out;
}

function save_one_file(s, rel, content, apply) {
	if (length(content || '') > 1048576)
		return { ok: false, error: 'Configuration is too large' };

	let path = resolve_config_file(s, rel, true);
	if (!path) return { ok: false, error: 'Invalid or missing configuration file' };

	let old = readfile(path) || '';
	let b = backup(path);
	let w = write_atomic(path, content || '');
	if (!w.ok) return w;

	let v = validate(s.binary, s.config);
	if (v.rc != 0) {
		write_atomic(path, old);
		return { ok: false, error: 'Validation failed; previous file restored', output: v.output, rolled_back: true, backup: b };
	}

	if (apply) {
		let r = run(shell_quote(s.binary) + ' reload');
		if (r.rc != 0) {
			write_atomic(path, old);
			run(shell_quote(s.binary) + ' reload');
			return { ok: false, error: 'Reload failed; previous file restored', output: r.output, rolled_back: true, backup: b };
		}
	}

	return { ok: true, backup: b, message: apply ? 'Configuration validated and hot-reloaded' : 'Configuration saved and validated' };
}

function include_status(s) {
	let content = readfile(s.config) || '';
	let clean = [];
	for (let idx, line in split(content, '\n')) {
		if (match(line, /^\s*#/)) continue;
		push(clean, line);
	}
	let joined = join('\n', clean);
	let enabled = !!match(joined, /include\s*\{[\s\S]*config\.d\/\*\.dae[\s\S]*\}/);
	return { enabled: enabled, pattern: enabled ? 'config.d/*.dae' : '' };
}

function managed_spec(kind) {
	let map = {
		nodes: { file: 'config.d/dae-ui-nodes.dae', section: 'node' },
		subscriptions: { file: 'config.d/dae-ui-subscriptions.dae', section: 'subscription' },
		groups: { file: 'config.d/dae-ui-groups.dae', section: 'group' },
		routing: { file: 'config.d/dae-ui-routing.dae', section: 'routing' },
		dns: { file: 'config.d/dae-ui-dns.dae', section: 'dns' }
	};
	return map[kind] || null;
}

function managed_content(section, body) {
	let lines = [
		'# Managed by luci-app-dae-ui. Manual edits are allowed, but keep this file valid DAE syntax.',
		section + ' {'
	];
	for (let idx, line in split(body || '', '\n'))
		push(lines, '    ' + line);
	push(lines, '}');
	push(lines, '');
	return join('\n', lines);
}

function managed_body(content, section) {
	for (let idx, sec in section_extract(content || '', '')) {
		if (sec.name != section) continue;
		let lines = split(sec.content || '', '\n');
		let body = [];
		for (let i = 1; i < length(lines) - 1; i++) {
			let line = lines[i];
			if (substr(line, 0, 4) == '    ') line = substr(line, 4);
			push(body, line);
		}
		return replace(join('\n', body), /\n+$/, '');
	}
	return '';
}

function get_managed(s, kind) {
	let spec = managed_spec(kind);
	if (!spec) return { ok: false, error: 'Unsupported managed section' };
	let inc = include_status(s);
	let path = resolve_config_file(s, spec.file, false);
	if (!path) return { ok: false, error: 'Invalid managed path' };
	let content = stat(path) ? (readfile(path) || '') : '';
	return {
		ok: true,
		kind: kind,
		path: spec.file,
		section: spec.section,
		body: managed_body(content, spec.section),
		exists: !!stat(path),
		include_enabled: inc.enabled
	};
}

function save_managed(s, kind, body, apply) {
	let spec = managed_spec(kind);
	if (!spec) return { ok: false, error: 'Unsupported managed section' };
	if (!include_status(s).enabled)
		return { ok: false, error: 'Main config does not include config.d/*.dae; managed writes are disabled for safety' };
	if (length(body || '') > 262144)
		return { ok: false, error: 'Managed section is too large' };

	let path = resolve_config_file(s, spec.file, false);
	if (!path) return { ok: false, error: 'Invalid managed path' };
	run('mkdir -p ' + shell_quote(dirname(path)));

	let existed = !!stat(path);
	let old = existed ? (readfile(path) || '') : '';
	let b = existed ? backup(path) : '';
	let w = write_atomic(path, managed_content(spec.section, body || ''));
	if (!w.ok) return w;

	let v = validate(s.binary, s.config);
	if (v.rc != 0) {
		if (existed) write_atomic(path, old);
		else run('rm -f ' + shell_quote(path));
		return { ok: false, error: 'Validation failed; managed file rolled back', output: v.output, rolled_back: true, backup: b };
	}

	if (apply) {
		let r = run(shell_quote(s.binary) + ' reload');
		if (r.rc != 0) {
			if (existed) write_atomic(path, old);
			else run('rm -f ' + shell_quote(path));
			run(shell_quote(s.binary) + ' reload');
			return { ok: false, error: 'Reload failed; managed file rolled back', output: r.output, rolled_back: true, backup: b };
		}
	}

	return { ok: true, path: spec.file, backup: b, message: apply ? 'Managed section validated and hot-reloaded' : 'Managed section saved and validated' };
}

function preview_managed(s, kind, body) {
	let spec = managed_spec(kind);
	if (!spec) return { ok: false, error: 'Unsupported managed section' };
	let path = resolve_config_file(s, spec.file, false);
	if (!path) return { ok: false, error: 'Invalid managed path' };

	let tmpdir = '/tmp/dae-ui-preview-' + pid() + '-' + stamp();
	run('mkdir -p ' + shell_quote(tmpdir));
	let current = tmpdir + '/current.dae';
	let staged = tmpdir + '/staged.dae';
	writefile(current, stat(path) ? (readfile(path) || '') : '');
	writefile(staged, managed_content(spec.section, body || ''));
	let d = run('diff -u ' + shell_quote(current) + ' ' + shell_quote(staged) + ' | head -500');
	run('rm -rf ' + shell_quote(tmpdir));
	return { ok: true, identical: !trim(d.output), output: d.output, path: spec.file };
}

function geo_candidate_dirs() {
	return [ '/usr/share/v2ray', '/usr/share/dae', '/usr/local/share/dae', '/etc/dae' ];
}

function geodata_status() {
	let found = [];
	for (let idx, dir in geo_candidate_dirs()) {
		let gi = stat(dir + '/geoip.dat');
		let gs = stat(dir + '/geosite.dat');
		if (gi || gs) {
			push(found, {
				dir: dir,
				geoip: !!gi,
				geoip_size: gi ? (gi.size || 0) : 0,
				geosite: !!gs,
				geosite_size: gs ? (gs.size || 0) : 0
			});
		}
	}
	return found;
}

function geodata_target_dir() {
	let found = geodata_status();
	for (let idx, item in found)
		if (item.geoip && item.geosite) return item.dir;
	for (let idx, item in found)
		if (item.geoip || item.geosite) return item.dir;
	return '/usr/share/v2ray';
}

function geodata_pins() {
	return {
		geoip_version: '202609050329',
		geoip_sha256: '1cba1f0982cf62502fa079c66047c3d0c608196da5b3305671e68f60e917a482',
		geoip_url: 'https://github.com/v2fly/geoip/releases/download/202609050329/geoip.dat',
		geosite_version: '20260908094002',
		geosite_sha256: '35ed26a24cafa1256bd7261414224b7bcef5c944cea7760e172b030a8b266450',
		geosite_url: 'https://github.com/v2fly/domain-list-community/releases/download/20260908094002/dlc.dat'
	};
}

function update_geodata() {
	let dir = geodata_target_dir();
	let pins = geodata_pins();
	let tmp = '/tmp/dae-ui-geodata-' + pid() + '-' + stamp();
	let prep = run('mkdir -p ' + shell_quote(tmp) + ' ' + shell_quote(dir));
	if (prep.rc != 0) return { ok: false, error: 'Unable to prepare GeoData directories', output: prep.output };

	let items = [
		{ name: 'geoip.dat', url: pins.geoip_url, sha: pins.geoip_sha256 },
		{ name: 'geosite.dat', url: pins.geosite_url, sha: pins.geosite_sha256 }
	];

	for (let idx, item in items) {
		let out = tmp + '/' + item.name;
		let dl = run('curl --fail --location --silent --show-error --retry 3 -o ' + shell_quote(out) + ' ' + shell_quote(item.url));
		if (dl.rc != 0) {
			run('rm -rf ' + shell_quote(tmp));
			return { ok: false, error: 'Download failed: ' + item.name, output: dl.output };
		}
		let got = trim(run('sha256sum ' + shell_quote(out) + " | awk '{print $1}'").output);
		if (got != item.sha) {
			run('rm -rf ' + shell_quote(tmp));
			return { ok: false, error: 'SHA256 mismatch: ' + item.name, expected: item.sha, actual: got };
		}
	}

	let suffix = stamp();
	for (let idx, item in items) {
		let dst = dir + '/' + item.name;
		if (stat(dst)) {
			let cp = run('cp -p ' + shell_quote(dst) + ' ' + shell_quote(dst + '.backup.' + suffix));
			if (cp.rc != 0) {
				run('rm -rf ' + shell_quote(tmp));
				return { ok: false, error: 'Unable to backup existing ' + item.name, output: cp.output };
			}
		}
	}

	for (let idx, item in items) {
		let dst = dir + '/' + item.name;
		let mv = run('chmod 644 ' + shell_quote(tmp + '/' + item.name) + ' && mv -f ' + shell_quote(tmp + '/' + item.name) + ' ' + shell_quote(dst));
		if (mv.rc != 0) {
			run('rm -rf ' + shell_quote(tmp));
			return { ok: false, error: 'Unable to install ' + item.name, output: mv.output };
		}
	}

	run('rm -rf ' + shell_quote(tmp));
	return { ok: true, directory: dir, pins: pins, message: 'GeoData downloaded, SHA256-verified and atomically installed' };
}

function process_cpu_ticks(p) {
	if (!p) return 0;
	let v = trim(run("awk '{print $14+$15}' /proc/" + p + "/stat 2>/dev/null").output);
	return match(v, /^[0-9]+$/) ? +v : 0;
}

function clock_ticks() {
	let v = trim(run('getconf CLK_TCK 2>/dev/null').output);
	return match(v, /^[0-9]+$/) && +v > 0 ? +v : 100;
}

function system_uptime() {
	let parts = split(trim(readfile('/proc/uptime') || '0'), ' ');
	return length(parts) ? +(parts[0] || 0) : 0;
}

function process_start_ticks(p) {
	if (!p) return 0;
	let v = trim(run("awk '{print $22}' /proc/" + p + "/stat 2>/dev/null").output);
	return match(v, /^[0-9]+$/) ? +v : 0;
}

function process_uptime(p) {
	if (!p) return 0;
	let hz = clock_ticks();
	let start = process_start_ticks(p);
	let up = system_uptime();
	if (!start || !up) return 0;
	let value = up - (start / hz);
	return value > 0 ? value : 0;
}

function socket_fds(p) {
	if (!p) return 0;
	let v = trim(run("ls -l /proc/" + p + "/fd 2>/dev/null | grep -c 'socket:'").output);
	return match(v, /^[0-9]+$/) ? +v : 0;
}

function ss_stats(p) {
	let available = run('command -v ss >/dev/null 2>&1').rc == 0;
	if (!available || !p) return { available: available, process_sockets: 0 };
	let v = trim(run("ss -Hntup 2>/dev/null | grep -c 'pid=" + p + ",'").output);
	return { available: true, process_sockets: match(v, /^[0-9]+$/) ? +v : 0 };
}

function interface_stats(name) {
	if (!iface_exists(name))
		return { present: false, name: name, rx_bytes: 0, tx_bytes: 0, rx_packets: 0, tx_packets: 0 };
	let base = '/sys/class/net/' + name + '/statistics/';
	return {
		present: true,
		name: name,
		rx_bytes: read_num(base + 'rx_bytes'),
		tx_bytes: read_num(base + 'tx_bytes'),
		rx_packets: read_num(base + 'rx_packets'),
		tx_packets: read_num(base + 'tx_packets')
	};
}

function runtime_stats() {
	let p = pid();
	let ss = ss_stats(p);
	return {
		ok: true,
		timestamp: now_epoch(),
		running: p > 0,
		pid: p,
		memory_kb: mem_kb(p),
		cpu_ticks: process_cpu_ticks(p),
		clock_ticks: clock_ticks(),
		process_uptime: process_uptime(p),
		socket_fds: socket_fds(p),
		ss_available: ss.available,
		ss_process_sockets: ss.process_sockets,
		dae0: interface_stats('dae0'),
		dae0peer: interface_stats('dae0peer')
	};
}

function uncomment_lines(content) {
	let out = [];
	for (let idx, line in split(content || '', '\n')) {
		if (match(line, /^\s*#/)) continue;
		push(out, line);
	}
	return join('\n', out);
}

function native_api_config(s) {
	let joined = '';
	for (let idx, f in config_files(s))
		joined += '\n' + uncomment_lines(readfile(f.full_path) || '');

	let has = !!match(joined, /native_api\s*\{/);
	let listen = '';
	let enabled = false;
	if (has) {
		let b = match(joined, /native_api\s*\{([^}]*)\}/);
		if (b) {
			let lm = match(b[1], /listen\s*:\s*['"]?([^'"\s]+)['"]?/);
			let em = match(b[1], /enabled\s*:\s*(true|false)/);
			listen = lm ? lm[1] : '';
			enabled = em ? em[1] == 'true' : true;
		}
	}
	return { detected: has, enabled: enabled, listen: listen };
}

function native_probe_url(listen) {
	let m;
	if (!listen) return '';
	m = match(listen, /^0\.0\.0\.0:([0-9]+)$/);
	if (m) return 'http://127.0.0.1:' + m[1];
	m = match(listen, /^\[::\]:([0-9]+)$/);
	if (m) return 'http://127.0.0.1:' + m[1];
	m = match(listen, /^:([0-9]+)$/);
	if (m) return 'http://127.0.0.1:' + m[1];
	if (match(listen, /^[A-Za-z0-9._-]+:[0-9]+$/))
		return 'http://' + listen;
	return '';
}

function http_probe(url) {
	if (!url) return { attempted: false, status: 0, body: '', headers: '' };
	let tag = '/tmp/dae-ui-http-' + pid() + '-' + stamp();
	let body = tag + '.body';
	let headers = tag + '.headers';
	let r = run('curl --connect-timeout 1 --max-time 2 --silent --show-error -D ' + shell_quote(headers) + ' -o ' + shell_quote(body) + " -w '%{http_code}' " + shell_quote(url));
	let status = match(trim(r.output), /^[0-9]{3}$/) ? +trim(r.output) : 0;
	let out = { attempted: true, status: status, body: readfile(body) || '', headers: readfile(headers) || '', rc: r.rc };
	run('rm -f ' + shell_quote(body) + ' ' + shell_quote(headers));
	return out;
}

function capability_available(body, key) {
	let needle = '"' + key + '"';
	let pos = index(body || '', needle);
	if (pos < 0) return null;
	let chunk = substr(body, pos, 400);
	if (match(chunk, /"available"\s*:\s*true/)) return true;
	if (match(chunk, /"available"\s*:\s*false/)) return false;
	return null;
}

function native_api_status(s) {
	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	let discovery = http_probe(base ? base + '/api' : '');
	let api_major = 0;
	let name = '';
	let base_path = '';
	if (discovery.status == 200) {
		let am = match(discovery.body, /"api_major"\s*:\s*([0-9]+)/);
		let nm = match(discovery.body, /"name"\s*:\s*"([^"]+)"/);
		let bm = match(discovery.body, /"base_path"\s*:\s*"([^"]+)"/);
		api_major = am ? +am[1] : 0;
		name = nm ? nm[1] : '';
		base_path = bm ? bm[1] : '';
	}
	let challenged = discovery.status == 401 && !!match(discovery.headers, /WWW-Authenticate:\s*Bearer/i);
	let compatible = (discovery.status == 200 && api_major == 1) || challenged;

	let cap = http_probe(base ? base + '/api/v1/capabilities' : '');
	let cap_body = cap.status == 200 ? cap.body : '';

	return {
		detected: cfg.detected,
		enabled: cfg.enabled,
		listen: cfg.listen,
		probe_base: base,
		discovery_status: discovery.status,
		api_major: api_major,
		name: name,
		base_path: base_path,
		auth_challenge: challenged,
		contract_ready: compatible,
		capabilities_status: cap.status,
		resources: {
			runtime: capability_available(cap_body, 'runtime'),
			runtime_memory: capability_available(cap_body, 'runtime_memory'),
			runtime_outbounds: capability_available(cap_body, 'runtime_outbounds'),
			nodes: capability_available(cap_body, 'nodes'),
			groups: capability_available(cap_body, 'groups'),
			probes: capability_available(cap_body, 'probes'),
			connections: capability_available(cap_body, 'connections'),
			flows: capability_available(cap_body, 'flows'),
			routing_trace: capability_available(cap_body, 'routing_trace'),
			dns_query: capability_available(cap_body, 'dns_query'),
			dns_cache: capability_available(cap_body, 'dns_cache'),
			dns_log: capability_available(cap_body, 'dns_log')
		}
	};
}

return {
	'luci.daeui': {
		status: {
			call: function() {
				let s = settings();
				let p = pid();
				let vr = stat(s.config) ? validate(s.binary, s.config) : { rc: 1, output: 'Config file missing' };
				return {
					running: p > 0,
					pid: p,
					memory_kb: mem_kb(p),
					version: version(s.binary),
					binary: s.binary,
					config_file: s.config,
					config_exists: !!stat(s.config),
					config_valid: vr.rc == 0,
					validate_output: vr.output,
					dae0: iface_exists('dae0'),
					dae0peer: iface_exists('dae0peer'),
					last_backup: latest_backup(s.config),
					config_files: length(config_files(s)),
					process_uptime: process_uptime(p),
					interfaces: trim(run('ip -brief link show 2>/dev/null').output),
					default_route: trim(run('ip route show default 2>/dev/null').output)
				};
			}
		},

		runtime_stats: {
			call: function() {
				return runtime_stats();
			}
		},

		service: {
			args: { action: 'string' },
			call: function(req) {
				let s = settings();
				let action = req.args.action || '';
				let allowed = { start: true, stop: true, restart: true, reload: true, enable: true, disable: true, suspend: true };
				if (!allowed[action]) return { ok: false, error: 'Unsupported action' };
				let cmd;
				if (action == 'reload') cmd = shell_quote(s.binary) + ' reload';
				else if (action == 'suspend') cmd = shell_quote(s.binary) + ' suspend';
				else cmd = shell_quote(s.init) + ' ' + action;
				let r = run(cmd);
				return { ok: r.rc == 0, rc: r.rc, output: r.output, message: r.rc == 0 ? 'Action completed: ' + action : '' };
			}
		},

		get_config: {
			call: function() {
				let s = settings();
				return { ok: true, path: s.config, content: readfile(s.config) || '', last_backup: latest_backup(s.config) };
			}
		},

		save_config: {
			args: { content: 'string' },
			call: function(req) {
				let s = settings();
				let rel = substr(s.config, length(config_base(s)) + 1);
				return save_one_file(s, rel, req.args.content || '', false);
			}
		},

		apply_config: {
			args: { content: 'string' },
			call: function(req) {
				let s = settings();
				let rel = substr(s.config, length(config_base(s)) + 1);
				return save_one_file(s, rel, req.args.content || '', true);
			}
		},

		restore_last: {
			call: function() {
				let s = settings();
				let b = latest_backup(s.config);
				if (!b) return { ok: false, error: 'No backup found' };
				let r = run('cp -f ' + shell_quote(b) + ' ' + shell_quote(s.config) + ' && ' + shell_quote(s.binary) + ' reload');
				return { ok: r.rc == 0, output: r.output, backup: b };
			}
		},

		list_config_files: {
			call: function() {
				let s = settings();
				return { ok: true, base: config_base(s), main: s.config, files: config_files(s) };
			}
		},

		get_config_file: {
			args: { path: 'string' },
			call: function(req) {
				let s = settings();
				let path = resolve_config_file(s, req.args.path || '', true);
				if (!path) return { ok: false, error: 'Invalid or missing configuration file' };
				return { ok: true, path: req.args.path, content: readfile(path) || '', latest_backup: latest_backup(path) };
			}
		},

		save_config_file: {
			args: { path: 'string', content: 'string', apply: 'bool' },
			call: function(req) {
				return save_one_file(settings(), req.args.path || '', req.args.content || '', !!req.args.apply);
			}
		},

		create_config_file: {
			args: { name: 'string', content: 'string', apply: 'bool' },
			call: function(req) {
				let s = settings();
				let name = req.args.name || '';
				if (!match(name, /^[A-Za-z0-9._-]+\.dae$/))
					return { ok: false, error: 'File name must end in .dae and contain only safe characters' };
				let rel = 'config.d/' + name;
				let path = resolve_config_file(s, rel, false);
				if (!path) return { ok: false, error: 'Invalid target path' };
				if (stat(path)) return { ok: false, error: 'File already exists' };

				run('mkdir -p ' + shell_quote(dirname(path)));
				let w = write_atomic(path, req.args.content || '');
				if (!w.ok) return w;

				let v = validate(s.binary, s.config);
				if (v.rc != 0) {
					run('rm -f ' + shell_quote(path));
					return { ok: false, error: 'Validation failed; new file removed', output: v.output, rolled_back: true };
				}

				if (req.args.apply) {
					let r = run(shell_quote(s.binary) + ' reload');
					if (r.rc != 0) {
						run('rm -f ' + shell_quote(path));
						run(shell_quote(s.binary) + ' reload');
						return { ok: false, error: 'Reload failed; new file removed', output: r.output, rolled_back: true };
					}
				}

				return { ok: true, path: rel, message: req.args.apply ? 'File created and hot-reloaded' : 'File created and validated' };
			}
		},

		get_sections: {
			call: function() {
				let s = settings();
				let all = [];
				for (let fidx, f in config_files(s)) {
					let sections = section_extract(readfile(f.full_path) || '', f.path);
					for (let sidx, sec in sections) push(all, sec);
				}
				return { ok: true, sections: all };
			}
		},

		list_backups: {
			call: function() {
				let s = settings();
				let base = config_base(s);
				let r = run('find ' + shell_quote(base) + " -maxdepth 3 -type f -name '*.dae.backup.*' 2>/dev/null | sort -r");
				let items = [];
				for (let idx, line in split(trim(r.output), '\n')) {
					if (!line) continue;
					let rel = substr(line, length(base) + 1);
					let st = stat(line);
					push(items, { path: rel, size: st ? (st.size || 0) : 0 });
				}
				return { ok: true, backups: items };
			}
		},

		diff_backup: {
			args: { path: 'string' },
			call: function(req) {
				let s = settings();
				let base = config_base(s);
				let rel = req.args.path || '';
				if (!match(rel, /^[A-Za-z0-9._\/-]+\.dae\.backup\.[0-9-]+$/) || match(rel, /(^|\/)\.\.(\/|$)/))
					return { ok: false, error: 'Invalid backup path' };
				let b = base + '/' + rel;
				if (!stat(b)) return { ok: false, error: 'Backup not found' };
				let current_rel = replace(rel, /\.backup\.[0-9-]+$/, '');
				let current = resolve_config_file(s, current_rel, true);
				if (!current) return { ok: false, error: 'Current configuration file not found' };
				let r = run('diff -u ' + shell_quote(b) + ' ' + shell_quote(current) + ' | head -400');
				return { ok: true, identical: !trim(r.output), output: r.output, current: current_rel };
			}
		},

		restore_backup: {
			args: { path: 'string', apply: 'bool' },
			call: function(req) {
				let s = settings();
				let base = config_base(s);
				let rel = req.args.path || '';
				if (!match(rel, /^[A-Za-z0-9._\/-]+\.dae\.backup\.[0-9-]+$/) || match(rel, /(^|\/)\.\.(\/|$)/))
					return { ok: false, error: 'Invalid backup path' };
				let b = base + '/' + rel;
				if (!stat(b)) return { ok: false, error: 'Backup not found' };

				let current_rel = replace(rel, /\.backup\.[0-9-]+$/, '');
				let current = resolve_config_file(s, current_rel, true);
				if (!current) return { ok: false, error: 'Current configuration file not found' };

				backup(current);
				let old = readfile(current) || '';
				let w = write_atomic(current, readfile(b) || '');
				if (!w.ok) return w;

				let v = validate(s.binary, s.config);
				if (v.rc != 0) {
					write_atomic(current, old);
					return { ok: false, error: 'Backup validation failed; current file restored', output: v.output, rolled_back: true };
				}

				if (req.args.apply) {
					let r = run(shell_quote(s.binary) + ' reload');
					if (r.rc != 0) {
						write_atomic(current, old);
						run(shell_quote(s.binary) + ' reload');
						return { ok: false, error: 'Reload failed; current file restored', output: r.output, rolled_back: true };
					}
				}

				return { ok: true, current: current_rel, message: req.args.apply ? 'Backup restored and hot-reloaded' : 'Backup restored and validated' };
			}
		},

		include_status: {
			call: function() {
				let s = settings();
				let v = include_status(s);
				v.main = s.config;
				return v;
			}
		},

		get_managed_section: {
			args: { kind: 'string' },
			call: function(req) {
				return get_managed(settings(), req.args.kind || '');
			}
		},

		save_managed_section: {
			args: { kind: 'string', body: 'string', apply: 'bool' },
			call: function(req) {
				return save_managed(settings(), req.args.kind || '', req.args.body || '', !!req.args.apply);
			}
		},

		preview_managed_section: {
			args: { kind: 'string', body: 'string' },
			call: function(req) {
				return preview_managed(settings(), req.args.kind || '', req.args.body || '');
			}
		},

		geodata_status: {
			call: function() {
				return { ok: true, locations: geodata_status(), target: geodata_target_dir(), pins: geodata_pins() };
			}
		},

		update_geodata: {
			call: function() {
				return update_geodata();
			}
		},

		get_log: {
			args: { limit: 'int' },
			call: function(req) {
				let s = settings();
				let n = +(req.args.limit || 250);
				if (n < 20) n = 20;
				if (n > 1000) n = 1000;
				let r = stat(s.log) ? run('tail -n ' + n + ' ' + shell_quote(s.log)) : run('logread | grep -i dae | tail -n ' + n);
				return { ok: true, output: r.output };
			}
		},

		clear_log: {
			call: function() {
				let s = settings();
				if (!stat(s.log)) return { ok: true, message: 'No standalone log file to clear' };
				let r = run(': > ' + shell_quote(s.log));
				return { ok: r.rc == 0, output: r.output };
			}
		},

		diagnose: {
			call: function() {
				let s = settings();
				let p = pid();
				let v = stat(s.config) ? validate(s.binary, s.config) : { rc: 1, output: 'Config file missing' };
				let route = run('ip route show default');
				let link = run('ip -brief link show dae0 2>/dev/null; ip -brief link show dae0peer 2>/dev/null');
				return {
					ok: p > 0 && v.rc == 0,
					checks: [
						{ name: 'dae process', state: p > 0 ? 'PASS' : 'FAIL', detail: p ? 'PID ' + p : 'not running' },
						{ name: 'configuration', state: v.rc == 0 ? 'PASS' : 'FAIL', detail: trim(v.output) },
						{ name: 'config files', state: length(config_files(s)) > 0 ? 'PASS' : 'WARN', detail: '' + length(config_files(s)) + ' .dae file(s)' },
						{ name: 'dae0 interface', state: iface_exists('dae0') ? 'PASS' : 'WARN', detail: trim(link.output) },
						{ name: 'default route', state: trim(route.output) ? 'PASS' : 'WARN', detail: trim(route.output) }
					]
				};
			}
		},

		native_api_status: {
			call: function() {
				let s = settings();
				let n = native_api_status(s);
				n.dashboard_exists = !!stat(s.dashboard + '/index.html');
				return n;
			}
		}
	}
};
