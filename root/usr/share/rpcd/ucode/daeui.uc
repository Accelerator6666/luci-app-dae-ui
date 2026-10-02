#!/usr/bin/ucode
'use strict';

import { readfile, writefile, popen, stat } from 'fs';
import { cursor } from 'uci';

function settings() {
	let u = cursor();
	if (u) u.load('dae-ui');
	let managed = u && u.get('dae-ui', 'main', 'version_manager_enabled');
	let selected = (u && u.get('dae-ui', 'main', 'selected_slot')) || 'system';
	let managed_binary = match(selected, /^[A-Za-z0-9._-]+$/)
		? '/usr/lib/dae-ui/versions/' + selected + '/dae'
		: '/usr/bin/dae';
	return {
		binary: managed == '1' ? managed_binary : ((u && u.get('dae-ui', 'main', 'binary')) || '/usr/bin/dae'),
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

function validation_diagnostics(s, output) {
	let items = [];
	let base = config_base(s);
	for (let idx, raw in split(output || '', '\n')) {
		let line = trim(raw);
		if (!line) continue;

		let m = match(line, /([^:]+\.dae):([0-9]+):([0-9]+):\s*(.*)$/);
		if (!m)
			m = match(line, /([^:]+\.dae):([0-9]+):\s*(.*)$/);

		if (m) {
			let file = trim(m[1]);
			let lineno = +(m[2] || 0);
			let col = length(m) >= 5 ? +(m[3] || 0) : 0;
			let msg = length(m) >= 5 ? (m[4] || line) : (m[3] || line);
			let rel = file;
			if (substr(file, 0, length(base) + 1) == base + '/')
				rel = substr(file, length(base) + 1);
			if (!safe_relative(rel))
				rel = '';
			push(items, { file: rel, line: lineno, column: col, message: trim(msg), raw: line });
			continue;
		}

		let p = match(line, /[Ll]ine\s+([0-9]+).*?[Cc]ol(?:umn)?\s+([0-9]+)/);
		if (p) {
			let rel = substr(s.config, length(base) + 1);
			push(items, { file: safe_relative(rel) ? rel : '', line: +(p[1] || 0), column: +(p[2] || 0), message: line, raw: line });
		}
	}
	return items;
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
		return { ok: false, error: 'Validation failed; previous file restored', output: v.output, diagnostics: validation_diagnostics(s, v.output), rolled_back: true, backup: b };
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
		return { ok: false, error: 'Validation failed; managed file rolled back', output: v.output, diagnostics: validation_diagnostics(s, v.output), rolled_back: true, backup: b };
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

function geodata_pin_file() {
	return '/etc/dae-ui/geodata-pins';
}

function geodata_upstream_source() {
	return 'https://raw.githubusercontent.com/daeuniverse/dae/main/scripts/fetch-geo-data.sh';
}

function geodata_build_pins(geoip_version, geoip_sha256, geosite_version, geosite_sha256, source, fetched_at) {
	if (!match(geoip_version || '', /^[0-9]{8,20}$/) ||
		!match(geosite_version || '', /^[0-9]{8,20}$/) ||
		!match(geoip_sha256 || '', /^[A-Fa-f0-9]{64}$/) ||
		!match(geosite_sha256 || '', /^[A-Fa-f0-9]{64}$/))
		return null;

	return {
		geoip_version: geoip_version,
		geoip_sha256: geoip_sha256,
		geoip_url: 'https://github.com/v2fly/geoip/releases/download/' + geoip_version + '/geoip.dat',
		geosite_version: geosite_version,
		geosite_sha256: geosite_sha256,
		geosite_url: 'https://github.com/v2fly/domain-list-community/releases/download/' + geosite_version + '/dlc.dat',
		source: source || 'builtin',
		source_url: geodata_upstream_source(),
		fetched_at: fetched_at || ''
	};
}

function geodata_builtin_pins() {
	return geodata_build_pins(
		'202609050329',
		'1cba1f0982cf62502fa079c66047c3d0c608196da5b3305671e68f60e917a482',
		'20260908094002',
		'35ed26a24cafa1256bd7261414224b7bcef5c944cea7760e172b030a8b266450',
		'builtin',
		''
	);
}

function geodata_parse_pin_text(content, source) {
	let gi_ver = match(content || '', /(^|\n)GEOIP_VERSION="?([0-9]{8,20})"?\s*($|\n)/);
	let gi_sha = match(content || '', /(^|\n)GEOIP_SHA256="?([A-Fa-f0-9]{64})"?\s*($|\n)/);
	let gs_ver = match(content || '', /(^|\n)GEOSITE_VERSION="?([0-9]{8,20})"?\s*($|\n)/);
	let gs_sha = match(content || '', /(^|\n)GEOSITE_SHA256="?([A-Fa-f0-9]{64})"?\s*($|\n)/);
	let fetched = match(content || '', /(^|\n)FETCHED_AT="?([0-9T:+Z-]+)"?\s*($|\n)/);
	if (!gi_ver || !gi_sha || !gs_ver || !gs_sha) return null;
	return geodata_build_pins(
		gi_ver[2], gi_sha[2], gs_ver[2], gs_sha[2],
		source || 'refreshed',
		fetched ? fetched[2] : ''
	);
}

function geodata_pins() {
	let saved = readfile(geodata_pin_file()) || '';
	let parsed = geodata_parse_pin_text(saved, 'refreshed');
	return parsed || geodata_builtin_pins();
}

function refresh_geodata_pins() {
	let url = geodata_upstream_source();
	let r = run(
		"curl --fail --location --silent --show-error --retry 2 --connect-timeout 8 --max-time 20 " +
		"-H 'User-Agent: luci-app-dae-ui' " + shell_quote(url)
	);
	if (r.rc != 0)
		return { ok: false, error: 'Unable to fetch dae upstream GeoData pin source', output: r.output, source_url: url };

	let parsed = geodata_parse_pin_text(r.output, 'upstream');
	if (!parsed)
		return { ok: false, error: 'dae upstream GeoData pin source did not contain the expected pinned version/SHA256 declarations', source_url: url };

	let fetched_at = trim(run("date -u '+%Y-%m-%dT%H:%M:%SZ'").output);
	let body =
		'GEOIP_VERSION=' + parsed.geoip_version + '\n' +
		'GEOIP_SHA256=' + parsed.geoip_sha256 + '\n' +
		'GEOSITE_VERSION=' + parsed.geosite_version + '\n' +
		'GEOSITE_SHA256=' + parsed.geosite_sha256 + '\n' +
		'FETCHED_AT=' + fetched_at + '\n';

	let prep = run('mkdir -p /etc/dae-ui && chmod 700 /etc/dae-ui');
	if (prep.rc != 0)
		return { ok: false, error: 'Unable to prepare GeoData pin state directory', output: prep.output };

	let w = write_atomic(geodata_pin_file(), body);
	if (!w.ok) return w;

	let saved = geodata_parse_pin_text(body, 'refreshed');
	return {
		ok: true,
		pins: saved,
		changed:
			saved.geoip_version != geodata_builtin_pins().geoip_version ||
			saved.geoip_sha256 != geodata_builtin_pins().geoip_sha256 ||
			saved.geosite_version != geodata_builtin_pins().geosite_version ||
			saved.geosite_sha256 != geodata_builtin_pins().geosite_sha256,
		message: 'GeoData pins refreshed from dae upstream scripts/fetch-geo-data.sh'
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

function native_token_path() {
	return '/etc/dae-ui/native-api.token';
}

function native_token() {
	return readfile(native_token_path()) || '';
}

function valid_native_token(token) {
	if (!token || length(token) > 512) return false;
	if (index(token, '\n') >= 0 || index(token, '\r') >= 0) return false;
	return true;
}

function set_native_token(token) {
	if (!valid_native_token(token))
		return { ok: false, error: 'Token must be 1-512 characters and contain no line breaks' };
	let dir = dirname(native_token_path());
	let prep = run('mkdir -p ' + shell_quote(dir) + ' && chmod 700 ' + shell_quote(dir));
	if (prep.rc != 0) return { ok: false, error: 'Unable to prepare private token directory', output: prep.output };
	let w = write_atomic(native_token_path(), token);
	if (!w.ok) return w;
	run('chmod 600 ' + shell_quote(native_token_path()));
	return { ok: true, configured: true, message: 'Native API token stored in a root-only file' };
}

function clear_native_token() {
	let r = run('rm -f ' + shell_quote(native_token_path()));
	return { ok: r.rc == 0, configured: false, message: r.rc == 0 ? 'Native API token removed' : '' };
}

function curl_config_escape(s) {
	s = replace(s || '', /\\/g, '\\\\');
	s = replace(s, /"/g, '\\"');
	return s;
}

function http_probe(url, authenticated, query) {
	if (!url) return { attempted: false, status: 0, body: '', headers: '' };

	let tag = '/tmp/dae-ui-http-' + pid() + '-' + stamp();
	let body = tag + '.body';
	let headers = tag + '.headers';
	let cfg = tag + '.curl';
	let authopt = '';
	let token = authenticated ? native_token() : '';

	if (token) {
		if (!valid_native_token(token))
			return { attempted: false, status: 0, body: '', headers: '', rc: 1, error: 'Stored token is invalid' };
		if (!writefile(cfg, 'header = "Authorization: Bearer ' + curl_config_escape(token) + '"\n'))
			return { attempted: false, status: 0, body: '', headers: '', rc: 1, error: 'Unable to prepare private curl config' };
		run('chmod 600 ' + shell_quote(cfg));
		authopt = ' --config ' + shell_quote(cfg);
	}

	let qopt = '';
	for (let idx, item in (query || []))
		qopt += ' --data-urlencode ' + shell_quote(item.name + '=' + item.value);

	let r = run('curl --connect-timeout 1 --max-time 3 --silent --show-error' + authopt +
		' -D ' + shell_quote(headers) + ' -o ' + shell_quote(body) +
		" -w '%{http_code}'" + (length(query || []) ? ' --get' : '') + qopt + ' ' + shell_quote(url));

	let status = match(trim(r.output), /^[0-9]{3}$/) ? +trim(r.output) : 0;
	let out = {
		attempted: true,
		status: status,
		body: readfile(body) || '',
		headers: readfile(headers) || '',
		rc: r.rc
	};
	run('rm -f ' + shell_quote(body) + ' ' + shell_quote(headers) + ' ' + shell_quote(cfg));
	return out;
}


function http_post_json(url, payload) {
	if (!url) return { attempted: false, status: 0, body: '', headers: '' };

	let tag = '/tmp/dae-ui-post-' + pid() + '-' + stamp();
	let body = tag + '.body';
	let headers = tag + '.headers';
	let cfg = tag + '.curl';
	let payload_file = tag + '.json';
	let token = native_token();
	let authopt = '';

	if (token) {
		if (!valid_native_token(token))
			return { attempted: false, status: 0, body: '', headers: '', rc: 1, error: 'Stored token is invalid' };
		if (!writefile(cfg, 'header = "Authorization: Bearer ' + curl_config_escape(token) + '"\nheader = "Content-Type: application/json"\n'))
			return { attempted: false, status: 0, body: '', headers: '', rc: 1, error: 'Unable to prepare private curl config' };
		run('chmod 600 ' + shell_quote(cfg));
		authopt = ' --config ' + shell_quote(cfg);
	} else {
		if (!writefile(cfg, 'header = "Content-Type: application/json"\n'))
			return { attempted: false, status: 0, body: '', headers: '', rc: 1, error: 'Unable to prepare curl config' };
		run('chmod 600 ' + shell_quote(cfg));
		authopt = ' --config ' + shell_quote(cfg);
	}

	if (!writefile(payload_file, sprintf('%J', payload || {}))) {
		run('rm -f ' + shell_quote(cfg));
		return { attempted: false, status: 0, body: '', headers: '', rc: 1, error: 'Unable to prepare JSON request body' };
	}
	run('chmod 600 ' + shell_quote(payload_file));

	let r = run('curl --connect-timeout 1 --max-time 5 --silent --show-error' + authopt +
		' -X POST --data-binary @' + shell_quote(payload_file) +
		' -D ' + shell_quote(headers) + ' -o ' + shell_quote(body) +
		" -w '%{http_code}' " + shell_quote(url));

	let status = match(trim(r.output), /^[0-9]{3}$/) ? +trim(r.output) : 0;
	let out = {
		attempted: true,
		status: status,
		body: readfile(body) || '',
		headers: readfile(headers) || '',
		rc: r.rc
	};
	run('rm -f ' + shell_quote(body) + ' ' + shell_quote(headers) + ' ' + shell_quote(cfg) + ' ' + shell_quote(payload_file));
	return out;
}

function native_dns_query(s, args) {
	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base) return { ok: false, status: 0, error: 'Native API listener is not locally probeable' };

	let domain = safe_query_text(args.domain, 255);
	if (!domain) return { ok: false, status: 0, error: 'DNS domain is required' };

	let query = [];
	query_add(query, 'domain', domain);
	let types = safe_query_text(args.record_types, 128);
	for (let idx, t in split(types || '', ',')) {
		t = trim(t);
		if (t && match(t, /^[A-Za-z0-9]+$/))
			query_add(query, 'type', t);
	}
	let upstream = safe_query_text(args.upstream, 512);
	if (upstream) query_add(query, 'upstream', upstream);
	if (args.cache_mode == 'normal' || args.cache_mode == 'bypass')
		query_add(query, 'cache_mode', args.cache_mode);
	query_add(query, 'detail', 'full');

	let r = http_probe(base + '/api/v1/dns/query', true, query);
	return {
		ok: r.status == 200,
		status: r.status,
		body: r.body || '',
		auth_required: r.status == 401,
		error: r.status == 200 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API request failed'))
	};
}

function native_routing_trace(s, args) {
	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base) return { ok: false, status: 0, error: 'Native API listener is not locally probeable' };

	let domain = safe_query_text(args.domain, 255);
	let dst_ip = safe_query_text(args.dst_ip, 128);
	if (!domain && !dst_ip)
		return { ok: false, status: 0, error: 'Routing trace requires domain or destination IP' };

	let network = args.network == 'udp' ? 'udp' : 'tcp';
	let dst_port = +(args.dst_port || 0);
	if (dst_port < 1 || dst_port > 65535) dst_port = 443;

	let input = { network: network, dst_port: dst_port };
	if (domain) input.domain = domain;
	if (dst_ip) input.dst_ip = dst_ip;

	let src_ip = safe_query_text(args.src_ip, 128);
	let pname = safe_query_text(args.pname, 256);
	let src_port = +(args.src_port || 0);
	if (src_ip) input.src_ip = src_ip;
	if (src_port >= 1 && src_port <= 65535) input.src_port = src_port;
	if (pname) input.pname = pname;

	let payload = {
		input: input,
		resolve: args.resolve == 'live' ? 'live' : 'none'
	};

	let r = http_post_json(base + '/api/v1/routing/trace', payload);
	return {
		ok: r.status == 200,
		status: r.status,
		body: r.body || '',
		auth_required: r.status == 401,
		error: r.status == 200 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API request failed'))
	};
}

function capability_available(body, key) {
	let needle = '"' + key + '"';
	let pos = index(body || '', needle);
	if (pos < 0) return null;
	let chunk = substr(body, pos, 500);
	if (match(chunk, /"available"\s*:\s*true/)) return true;
	if (match(chunk, /"available"\s*:\s*false/)) return false;
	return null;
}

function safe_query_text(value, maxlen) {
	let s = value || '';
	if (!s || length(s) > maxlen || index(s, '\n') >= 0 || index(s, '\r') >= 0)
		return '';
	return s;
}

function query_add(out, name, value) {
	if (value === null || value === '' || value === false) return;
	push(out, { name: name, value: '' + value });
}

function native_resource_path(kind) {
	let paths = {
		runtime: '/api/v1/runtime',
		runtime_outbounds: '/api/v1/runtime/outbounds',
		nodes: '/api/v1/nodes',
		groups: '/api/v1/groups',
		connections: '/api/v1/connections',
		flows: '/api/v1/flows',
		config: '/api/v1/config',
		rules: '/api/v1/rules',
		dns_rules: '/api/v1/dns/rules',
		dns_cache: '/api/v1/dns/cache',
		dns_log: '/api/v1/dns/log'
	};
	return paths[kind] || '';
}

function native_resource_query(kind, args) {
	let out = [];
	let limit = +(args.limit || 0);
	if (limit < 1 || limit > 1000)
		limit = kind == 'dns_log' ? 500 : 1000;

	if (kind == 'connections') {
		query_add(out, 'detail', 'full');
		query_add(out, 'limit', limit);
		if (args.type == 'tcp' || args.type == 'udp' || args.type == 'all')
			query_add(out, 'type', args.type);
		let src = safe_query_text(args.src, 128);
		if (src) query_add(out, 'src', src);
	} else if (kind == 'nodes') {
		query_add(out, 'limit', limit);
		let group_id = safe_query_text(args.group_id, 256);
		let cursor = safe_query_text(args.cursor, 4096);
		if (group_id) query_add(out, 'group_id', group_id);
		if (cursor) query_add(out, 'cursor', cursor);
	} else if (kind == 'flows') {
		query_add(out, 'detail', 'full');
		query_add(out, 'limit', limit);
		if (args.network == 'tcp' || args.network == 'udp' || args.network == 'all')
			query_add(out, 'network', args.network);
		let state = safe_query_text(args.state, 48);
		let connection_id = safe_query_text(args.connection_id, 256);
		let cursor = safe_query_text(args.cursor, 4096);
		if (state) query_add(out, 'state', state);
		if (connection_id) query_add(out, 'connection_id', connection_id);
		if (cursor) query_add(out, 'cursor', cursor);
	} else if (kind == 'dns_cache') {
		query_add(out, 'detail', 'full');
		query_add(out, 'limit', limit);
		let name = safe_query_text(args.name, 255);
		let domain = safe_query_text(args.domain, 255);
		let record_type = safe_query_text(args.record_type, 32);
		let cursor = safe_query_text(args.cursor, 4096);
		if (name) query_add(out, 'name', name);
		if (domain) query_add(out, 'domain', domain);
		if (record_type) query_add(out, 'type', record_type);
		if (args.include_expired) query_add(out, 'include_expired', 'true');
		if (cursor) query_add(out, 'cursor', cursor);
	} else if (kind == 'dns_log') {
		query_add(out, 'limit', limit);
		let name = safe_query_text(args.name, 255);
		let record_type = safe_query_text(args.record_type, 32);
		let src = safe_query_text(args.src, 128);
		let cursor = safe_query_text(args.cursor, 4096);
		if (name) query_add(out, 'name', name);
		if (record_type) query_add(out, 'type', record_type);
		if (src) query_add(out, 'src', src);
		if (cursor) query_add(out, 'cursor', cursor);
	}

	return out;
}

function native_api_get(s, args) {
	let kind = args.resource || '';
	let path = native_resource_path(kind);
	if (!path) return { ok: false, status: 0, error: 'Unsupported Native API resource' };

	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base) return { ok: false, status: 0, error: 'Native API listener is not locally probeable' };

	let r = http_probe(base + path, true, native_resource_query(kind, args));
	return {
		ok: r.status == 200,
		status: r.status,
		body: r.body || '',
		auth_required: r.status == 401,
		error: r.status == 200 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API request failed'))
	};
}


function retry_after_seconds(headers) {
	let m = match(headers || '', /Retry-After:\s*([0-9]+)/i);
	let n = m ? +(m[1] || 0) : 0;
	return n > 0 && n <= 30 ? n : 1;
}

function native_probe_start(s, args) {
	let target_type = args.target_type == 'group' ? 'group' : 'node';
	let target_id = safe_native_id(args.target_id);
	if (!target_id)
		return { ok: false, status: 0, error: 'Probe target ID is required' };

	let caps = native_capabilities(s);
	if (!caps.ok)
		return { ok: false, status: caps.status, error: caps.error || 'Unable to read Native API capabilities' };

	let probes = probe_options_from_capabilities(caps.data);
	if (!probes.available || !array_has(probes.targets, target_type))
		return { ok: false, status: 0, error: 'Requested probe target type is not advertised' };

	let kind = args.kind || '';
	if (!array_has(probes.kinds, kind))
		return { ok: false, status: 0, error: 'Requested probe kind is not advertised' };

	let purpose = kind == 'dns' ? 'dns' : 'data';
	if (!array_has(probes.purposes, purpose))
		return { ok: false, status: 0, error: 'Probe purpose required by this kind is not advertised' };

	let transport = args.transport || '';
	if (!array_has(probes.transports, transport))
		return { ok: false, status: 0, error: 'Requested probe transport is not advertised' };
	if ((kind == 'tcp_connect' || kind == 'http') && transport != 'tcp')
		return { ok: false, status: 0, error: 'tcp_connect/http probes require TCP transport' };

	let ipv4 = array_has(probes.ip_versions, 'ipv4');
	let ipv6 = array_has(probes.ip_versions, 'ipv6');
	let ip_version = args.ip_version || '';
	if (ip_version == 'any') {
		if (!ipv4 || !ipv6)
			return { ok: false, status: 0, error: 'ip_version=any requires both IPv4 and IPv6 capability' };
	} else if (!array_has(probes.ip_versions, ip_version)) {
		return { ok: false, status: 0, error: 'Requested IP version is not advertised' };
	}

	let warmth = args.warmth == 'cold' ? 'cold' : 'warm';
	let limits = probes.limits || {};
	let max_members = +(limits.max_members_per_job || 0);
	let max_results = +(limits.max_results_per_job || 0);
	if (max_members < 1 || max_results < 1)
		return { ok: false, status: 0, error: 'Probe limits do not permit a request' };

	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base)
		return { ok: false, status: 0, error: 'Native API listener is not locally probeable' };

	let payload = {
		target: target_type == 'group'
			? { type: 'group', group_id: target_id }
			: { type: 'node', node_id: target_id },
		kind: kind,
		purpose: purpose,
		transport: [ transport ],
		ip_version: ip_version,
		warmth: warmth
	};

	let member_count = 1;
	if (target_type == 'group') {
		let gr = http_probe(base + '/api/v1/groups/' + target_id, true, []);
		if (gr.status != 200)
			return { ok: false, status: gr.status, error: gr.status ? 'Native API returned HTTP ' + gr.status + ' reading group' : 'Unable to read group' };

		let group = parse_json_safe(gr.body);
		if (type(group) != 'object')
			return { ok: false, status: 0, error: 'Native API returned invalid group JSON' };

		let allowed_transports = group.capabilities && group.capabilities.probe_transports;
		if (type(allowed_transports) == 'array' && !array_has(allowed_transports, transport))
			return { ok: false, status: 0, error: 'This group does not advertise the selected probe transport' };

		let chosen = probe_member_ids(group, args.members_json || '');
		if (chosen === null)
			return { ok: false, status: 0, error: 'Probe member list is invalid or contains members outside the group' };

		if (length(chosen)) {
			payload.members = chosen;
			member_count = length(chosen);
		} else {
			payload.members = 'direct';
			member_count = length(group.members || []);
		}
	}

	let dimensions = ip_version == 'any' ? 2 : 1;
	if (member_count < 1)
		return { ok: false, status: 0, error: 'Probe target contains no members' };
	if (member_count > max_members || member_count * dimensions > max_results)
		return {
			ok: false,
			status: 0,
			error: 'Probe request exceeds advertised limits',
			max_members_per_job: max_members,
			max_results_per_job: max_results,
			requested_members: member_count,
			requested_results: member_count * dimensions
		};

	let r = http_post_json(base + '/api/v1/probes', payload);
	return {
		ok: r.status == 202,
		status: r.status,
		body: r.body || '',
		retry_after: retry_after_seconds(r.headers),
		auth_required: r.status == 401,
		error: r.status == 202 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API probe request failed'))
	};
}

function native_operation_get(s, args) {
	let operation_id = safe_query_text(args.operation_id, 256);
	if (!operation_id || !match(operation_id, /^[A-Za-z0-9._:-]+$/))
		return { ok: false, status: 0, error: 'Invalid operation ID' };

	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base)
		return { ok: false, status: 0, error: 'Native API listener is not locally probeable' };

	let r = http_probe(base + '/api/v1/operations/' + operation_id, true, []);
	return {
		ok: r.status == 200,
		status: r.status,
		body: r.body || '',
		retry_after: retry_after_seconds(r.headers),
		auth_required: r.status == 401,
		error: r.status == 200 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API operation request failed'))
	};
}


function parse_json_safe(raw) {
	try {
		return json(raw || '{}');
	} catch (e) {
		return null;
	}
}

function array_has(values, wanted) {
	if (type(values) != 'array') return false;
	for (let idx, value in values)
		if (value == wanted) return true;
	return false;
}

function native_capabilities(s) {
	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base) return { ok: false, status: 0, error: 'Native API listener is not locally probeable', data: null };

	let r = http_probe(base + '/api/v1/capabilities', true, []);
	let data = r.status == 200 ? parse_json_safe(r.body) : null;
	return {
		ok: r.status == 200 && type(data) == 'object',
		status: r.status,
		error: r.status == 200 && type(data) != 'object' ? 'Native API returned invalid capabilities JSON' :
			(r.status == 200 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API request failed'))),
		data: data
	};
}

function probe_options_from_capabilities(data) {
	let probes = data && data.resources && data.resources.probes;
	if (type(probes) != 'object')
		return { available: false, targets: [], kinds: [], purposes: [], transports: [], ip_versions: [], limits: {} };

	return {
		available: probes.available === true,
		targets: type(probes.targets) == 'array' ? probes.targets : [],
		kinds: type(probes.kinds) == 'array' ? probes.kinds : [],
		purposes: type(probes.purposes) == 'array' ? probes.purposes : [],
		transports: type(probes.transports) == 'array' ? probes.transports : [],
		ip_versions: type(probes.ip_versions) == 'array' ? probes.ip_versions : [],
		limits: type(probes.limits) == 'object' ? probes.limits : {}
	};
}

function safe_native_id(value) {
	let id = value || '';
	if (!id || length(id) > 256 || !match(id, /^[A-Za-z0-9._:-]+$/))
		return '';
	return id;
}

function native_group_get(s, args) {
	let id = safe_native_id(args.group_id);
	if (!id) return { ok: false, status: 0, error: 'Invalid group ID' };

	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base) return { ok: false, status: 0, error: 'Native API listener is not locally probeable' };

	let r = http_probe(base + '/api/v1/groups/' + id, true, []);
	return {
		ok: r.status == 200,
		status: r.status,
		body: r.body || '',
		auth_required: r.status == 401,
		error: r.status == 200 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API group request failed'))
	};
}

function native_flow_get(s, args) {
	let id = safe_native_id(args.flow_id);
	if (!id) return { ok: false, status: 0, error: 'Invalid flow ID' };

	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	if (!base) return { ok: false, status: 0, error: 'Native API listener is not locally probeable' };

	let r = http_probe(base + '/api/v1/flows/' + id, true, []);
	return {
		ok: r.status == 200,
		status: r.status,
		body: r.body || '',
		auth_required: r.status == 401,
		error: r.status == 200 ? '' : (r.status ? 'Native API returned HTTP ' + r.status : (r.error || 'Native API flow request failed'))
	};
}

function probe_member_ids(group, raw) {
	let members = [];
	if (!raw) return members;

	let parsed = parse_json_safe(raw);
	if (type(parsed) != 'array') return null;

	let allowed = {};
	for (let idx, member in (group.members || []))
		if (member && member.id) allowed[member.id] = true;

	for (let idx, value in parsed) {
		let id = type(value) == 'string' ? value : '';
		if (!id || length(id) > 256 || !allowed[id]) return null;
		if (!array_has(members, id)) push(members, id);
	}
	return members;
}


function vm_root() {
	return '/usr/lib/dae-ui/versions';
}

function vm_runner() {
	return '/usr/libexec/dae-ui/dae-runner';
}

function vm_guard() {
	return '/usr/libexec/dae-ui/version-boot-guard';
}

function vm_safe_slot(slot) {
	return !!slot && length(slot) <= 128 && !!match(slot, /^[A-Za-z0-9._-]+$/);
}

function vm_slot_path(slot) {
	return vm_safe_slot(slot) ? vm_root() + '/' + slot + '/dae' : '';
}

function vm_service_config(s) {
	let u = cursor();
	let cfg = '';
	if (u) {
		u.load('dae');
		cfg = u.get('dae', 'config', 'config_file') || '';
	}
	return cfg || s.config || '/etc/dae/config.dae';
}

function vm_service_enabled() {
	let u = cursor();
	if (!u) return false;
	u.load('dae');
	let v = u.get('dae', 'config', 'enabled');
	return v == '1' || v == 1 || v === true;
}

function vm_option(name, def) {
	let u = cursor();
	if (!u) return def;
	u.load('dae-ui');
	let v = u.get('dae-ui', 'main', name);
	return v === null || v === undefined || v === '' ? def : v;
}

function vm_enabled() {
	let v = vm_option('version_manager_enabled', '0');
	return v == '1' || v == 1 || v === true;
}

function vm_selected() {
	let v = vm_option('selected_slot', 'system');
	return vm_safe_slot(v) ? v : 'system';
}

function vm_last_good() {
	let v = vm_option('last_good_slot', 'system');
	return vm_safe_slot(v) ? v : 'system';
}

function vm_set_selection(slot, last_good, enabled) {
	if (!vm_safe_slot(slot) || !vm_safe_slot(last_good))
		return { ok: false, error: 'Invalid version slot' };

	let cmd =
		"uci -q get dae-ui.main >/dev/null 2>&1 || uci -q set dae-ui.main=main; " +
		"uci -q set dae-ui.main.version_manager_enabled=" + shell_quote(enabled ? '1' : '0') + "; " +
		"uci -q set dae-ui.main.selected_slot=" + shell_quote(slot) + "; " +
		"uci -q set dae-ui.main.last_good_slot=" + shell_quote(last_good) + "; " +
		"uci -q set dae-ui.main.binary='/usr/bin/dae'; " +
		"uci -q commit dae-ui";
	let r = run(cmd);
	return { ok: r.rc == 0, output: r.output };
}

function vm_slot_info(s, slot) {
	if (!vm_safe_slot(slot)) return null;
	let path = vm_slot_path(slot);
	let st = stat(path);
	if (!st) return null;

	let ver = version(path);
	let sha = trim(run('sha256sum ' + shell_quote(path) + " 2>/dev/null | awk '{print $1}'").output);
	let meta = readfile(vm_root() + '/' + slot + '/source.txt') || '';
	let source_type = slot == 'system' || match(slot, /^system-prev-/) ? 'system' : '';
	let source_label = '';
	let mt = match(meta, /(^|\n)type=([^\n]+)/);
	let ml = match(meta, /(^|\n)label=([^\n]+)/);
	let tag = match(meta, /(^|\n)tag=([^\n]+)/);
	let asset = match(meta, /(^|\n)asset=([^\n]+)/);
	if (mt) source_type = trim(mt[2]);
	if (!source_type && tag) source_type = 'official-release';
	if (ml) source_label = trim(ml[2]);
	else if (tag) source_label = trim(tag[2]) + (asset ? ' / ' + trim(asset[2]) : '');

	return {
		slot: slot,
		path: path,
		version: ver,
		sha256: sha,
		size: st.size || 0,
		source_type: source_type || 'unknown',
		source_label: source_label,
		selected: slot == vm_selected(),
		last_good: slot == vm_last_good(),
		system: slot == 'system'
	};
}

function vm_slots(s) {
	let root = vm_root();
	let r = run('find ' + shell_quote(root) + " -maxdepth 2 -type f -name dae 2>/dev/null | sort");
	let out = [];
	for (let idx, path in split(trim(r.output), '\n')) {
		if (!path || substr(path, 0, length(root) + 1) != root + '/') continue;
		let rel = substr(path, length(root) + 1);
		let parts = split(rel, '/');
		if (length(parts) != 2 || parts[1] != 'dae' || !vm_safe_slot(parts[0])) continue;
		let info = vm_slot_info(s, parts[0]);
		if (info) push(out, info);
	}
	return out;
}

function vm_arch_assets() {
	let arch = trim(run('uname -m').output);
	let names = [];
	if (arch == 'x86_64' || arch == 'amd64') {
		names = [
			'dae-linux-x86_64.zip',
			'dae-linux-x86_64_v2_sse.zip',
			'dae-linux-x86_64_v3_avx2.zip'
		];
	} else if (arch == 'aarch64' || arch == 'arm64') {
		names = [ 'dae-linux-arm64.zip' ];
	} else if (match(arch, /^armv7/)) {
		names = [ 'dae-linux-armv7.zip' ];
	} else if (match(arch, /^armv6/)) {
		names = [ 'dae-linux-armv6.zip' ];
	} else if (match(arch, /^armv5/)) {
		names = [ 'dae-linux-armv5.zip' ];
	} else if (match(arch, /^(i[3-6]86|x86)$/)) {
		names = [ 'dae-linux-x86_32.zip' ];
	} else if (arch == 'mips64el' || arch == 'mips64le') {
		names = [ 'dae-linux-mips64le.zip' ];
	} else if (arch == 'mips64') {
		names = [ 'dae-linux-mips64.zip' ];
	} else if (arch == 'mipsel' || arch == 'mipsle') {
		names = [ 'dae-linux-mips32le.zip' ];
	} else if (arch == 'mips') {
		names = [ 'dae-linux-mips32.zip' ];
	} else if (arch == 'riscv64') {
		names = [
			'dae-linux-riscv64.zip',
			'dae-linux-riscv64_rva20u64.zip',
			'dae-linux-riscv64_rva22u64.zip',
			'dae-linux-riscv64_rva23u64.zip'
		];
	} else if (arch == 'loongarch64' || arch == 'loong64') {
		names = [ 'dae-linux-loongarch64.zip' ];
	} else if (arch == 'ppc64le') {
		names = [ 'dae-linux-powerpc64le.zip' ];
	} else if (arch == 'ppc64') {
		names = [ 'dae-linux-powerpc64.zip' ];
	} else if (arch == 's390x') {
		names = [ 'dae-linux-s390x.zip' ];
	}
	return { arch: arch, assets: names };
}

function vm_allowed_asset(name) {
	if (!name || length(name) > 128 || !match(name, /^dae-[A-Za-z0-9._-]+\.zip$/))
		return false;
	let p = vm_arch_assets();
	return array_has(p.assets, name);
}

function vm_release_list() {
	let platform = vm_arch_assets();
	let r = run(
		"curl --fail --location --silent --show-error --connect-timeout 8 --max-time 20 " +
		"-H 'Accept: application/vnd.github+json' -H 'User-Agent: luci-app-dae-ui' " +
		"'https://api.github.com/repos/daeuniverse/dae/releases?per_page=20'"
	);
	if (r.rc != 0)
		return { ok: false, error: 'Unable to query dae GitHub releases', output: r.output, arch: platform.arch, assets: platform.assets };

	let data = parse_json_safe(r.output);
	if (type(data) != 'array')
		return { ok: false, error: 'GitHub returned invalid release JSON', arch: platform.arch, assets: platform.assets };

	let releases = [];
	for (let ridx, rel in data) {
		if (!rel || rel.draft === true) continue;
		let tag = rel.tag_name || '';
		if (!match(tag, /^[A-Za-z0-9._-]+$/) || length(tag) > 80) continue;

		let assets = [];
		for (let aidx, asset in (rel.assets || [])) {
			let name = asset && asset.name || '';
			if (!vm_allowed_asset(name)) continue;
			push(assets, {
				name: name,
				size: asset.size || 0,
				digest: asset.digest || '',
				download_count: asset.download_count || 0
			});
		}
		if (!length(assets)) continue;

		push(releases, {
			tag: tag,
			name: rel.name || tag,
			prerelease: rel.prerelease === true,
			published_at: rel.published_at || '',
			assets: assets
		});
	}
	return { ok: true, arch: platform.arch, allowed_assets: platform.assets, releases: releases };
}

function vm_candidate_version(path) {
	let r = run(shell_quote(path) + ' --version');
	if (r.rc != 0 || !trim(r.output))
		r = run(shell_quote(path) + ' version');
	return { ok: r.rc == 0 && !!trim(r.output), version: trim(split(r.output || '', '\n')[0] || ''), output: r.output };
}

function vm_upload_path() {
	return '/tmp/dae-ui-dae-upload.bin';
}

function vm_uploaded_kind(filename) {
	let name = filename || '';
	if (match(name, /\.zip$/i))
		return 'zip';
	if (match(name, /\.(tar\.gz|tgz)$/i))
		return 'tar.gz';
	if (match(name, /\.(tar\.xz|txz|tar\.zst|tzst|7z|rar)$/i))
		return 'unsupported-archive';
	return 'binary';
}

function vm_safe_archive_member(member) {
	if (!member || match(member, /^\//) || match(member, /(^|\/)\.\.(\/|$)/))
		return false;
	return true;
}

function vm_archive_payload(listing) {
	let candidate = '';
	let count = 0;
	for (let idx, raw in split(listing || '', '\n')) {
		let member = trim(raw || '');
		if (!member)
			continue;

		count++;
		if (count > 500)
			return { ok: false, error: 'Uploaded archive contains too many entries' };

		if (!vm_safe_archive_member(member))
			return { ok: false, error: 'Uploaded archive contains an unsafe path' };

		if (match(member, /\/$/))
			continue;

		let parts = split(member, '/');
		let base = length(parts) ? parts[length(parts) - 1] : '';
		if (base != 'dae' && !match(base, /^dae-[A-Za-z0-9._+-]+$/))
			continue;

		if (candidate && candidate != member)
			return { ok: false, error: 'Uploaded archive must contain exactly one dae executable' };

		candidate = member;
	}

	if (!candidate)
		return { ok: false, error: 'Uploaded archive must contain exactly one dae executable' };

	return { ok: true, member: candidate };
}

function vm_prepare_uploaded(source, filename) {
	let kind = vm_uploaded_kind(filename);
	if (kind == 'unsupported-archive')
		return { ok: false, error: 'Unsupported archive format; use a raw dae executable, .zip, .tar.gz or .tgz' };
	if (kind == 'binary')
		return { ok: true, path: source, kind: kind, archive_sha256: '', temp_dir: '' };

	let archive_sha = trim(run("sha256sum " + shell_quote(source) + " | awk '{print $1}'").output);
	if (!match(archive_sha, /^[A-Fa-f0-9]{64}$/))
		return { ok: false, error: 'Unable to calculate uploaded archive SHA256' };

	let tmp = '/tmp/dae-ui-upload-extract-' + pid() + '-' + stamp();
	let prep = run('mkdir -m 700 -p ' + shell_quote(tmp));
	if (prep.rc != 0)
		return { ok: false, error: 'Unable to prepare archive extraction workspace', output: prep.output };

	let list;
	if (kind == 'zip')
		list = run('unzip -Z1 ' + shell_quote(source) + ' 2>/dev/null | head -501');
	else
		list = run('tar -tzf ' + shell_quote(source) + ' 2>/dev/null | head -501');

	let payload = vm_archive_payload(list.output);
	if (!payload.ok) {
		run('rm -rf ' + shell_quote(tmp));
		return payload;
	}

	let candidate = tmp + '/dae';
	let extract;
	if (kind == 'zip')
		extract = run('(ulimit -f 262144; unzip -p ' + shell_quote(source) + ' ' + shell_quote(payload.member) + ' > ' + shell_quote(candidate) + ')');
	else
		extract = run('(ulimit -f 262144; tar -xOzf ' + shell_quote(source) + ' ' + shell_quote(payload.member) + ' > ' + shell_quote(candidate) + ')');

	if (extract.rc != 0) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Unable to extract dae executable from uploaded archive', output: extract.output };
	}

	let st = stat(candidate);
	let size = st ? +(st.size || 0) : 0;
	if (size < 1024 || size > 134217728) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Extracted dae binary size is outside the accepted 1 KiB to 128 MiB range', size: size };
	}

	let chmod = run('chmod 755 ' + shell_quote(candidate));
	if (chmod.rc != 0) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Unable to mark extracted dae binary executable', output: chmod.output };
	}

	return {
		ok: true,
		path: candidate,
		kind: kind,
		member: payload.member,
		archive_sha256: archive_sha,
		temp_dir: tmp
	};
}

function vm_import_uploaded(s, label, filename) {
	let source = vm_upload_path();
	let temp_dir = '';
	let cleanup = function() {
		run('rm -f ' + shell_quote(source));
		if (temp_dir)
			run('rm -rf ' + shell_quote(temp_dir));
	};

	let safe_file = run('test -f ' + shell_quote(source) + ' && test ! -L ' + shell_quote(source));
	if (safe_file.rc != 0) {
		cleanup();
		return { ok: false, error: 'Uploaded dae file is missing or is not a regular file' };
	}

	let upload_stat = stat(source);
	let upload_size = upload_stat ? +(upload_stat.size || 0) : 0;
	if (upload_size < 1024 || upload_size > 134217728) {
		cleanup();
		return { ok: false, error: 'Uploaded dae file size is outside the accepted 1 KiB to 128 MiB range', size: upload_size };
	}

	let prepared = vm_prepare_uploaded(source, filename || '');
	if (!prepared.ok) {
		cleanup();
		return prepared;
	}
	temp_dir = prepared.temp_dir || '';

	let candidate = prepared.path;
	if (prepared.kind == 'binary') {
		let chmod = run('chmod 755 ' + shell_quote(candidate));
		if (chmod.rc != 0) {
			cleanup();
			return { ok: false, error: 'Unable to mark uploaded dae binary executable', output: chmod.output };
		}
	} else {
		run('rm -f ' + shell_quote(source));
	}

	let actual = trim(run("sha256sum " + shell_quote(candidate) + " | awk '{print $1}'").output);
	if (!match(actual, /^[A-Fa-f0-9]{64}$/)) {
		cleanup();
		return { ok: false, error: 'Unable to calculate uploaded dae SHA256' };
	}

	let smoke = vm_candidate_version(candidate);
	if (!smoke.ok) {
		cleanup();
		return { ok: false, error: 'Uploaded file failed the dae execution smoke test', output: smoke.output };
	}

	let cfg = vm_service_config(s);
	let val = validate(candidate, cfg);
	if (val.rc != 0) {
		cleanup();
		return {
			ok: false,
			error: 'Uploaded dae binary is incompatible with the current service configuration',
			output: val.output,
			diagnostics: validation_diagnostics(s, val.output),
			config_file: cfg
		};
	}

	let clean_label = replace(trim(label || ''), /[^A-Za-z0-9._-]/g, '_');
	if (!clean_label) clean_label = 'upload';
	if (length(clean_label) > 48) clean_label = substr(clean_label, 0, 48);

	let slot = 'custom-' + clean_label + '-' + substr(actual, 0, 12);
	if (!vm_safe_slot(slot)) {
		cleanup();
		return { ok: false, error: 'Unable to derive a safe custom version slot' };
	}

	let dir = vm_root() + '/' + slot;
	let target = dir + '/dae';
	let existing = stat(target);
	if (existing) {
		let installed_sha = trim(run("sha256sum " + shell_quote(target) + " 2>/dev/null | awk '{print $1}'").output);
		cleanup();
		if (installed_sha == actual) {
			return {
				ok: true,
				slot: slot,
				path: target,
				version: smoke.version,
				sha256: actual,
				archive_sha256: prepared.archive_sha256 || '',
				archive_type: prepared.kind != 'binary' ? prepared.kind : '',
				config_file: cfg,
				message: 'This exact custom dae binary is already installed'
			};
		}
		return { ok: false, error: 'Custom version slot already exists with different content; refusing to overwrite it' };
	}

	let prep = run('mkdir -p ' + shell_quote(dir));
	if (prep.rc != 0) {
		cleanup();
		return { ok: false, error: 'Unable to create custom version slot', output: prep.output };
	}

	let mv = run('mv ' + shell_quote(candidate) + ' ' + shell_quote(target) + ' && chmod 755 ' + shell_quote(target));
	if (mv.rc != 0) {
		cleanup();
		run('rmdir ' + shell_quote(dir) + ' 2>/dev/null');
		return { ok: false, error: 'Unable to install uploaded dae binary', output: mv.output };
	}

	let clean_filename = replace(trim(filename || ''), /[^A-Za-z0-9._+-]/g, '_');
	if (length(clean_filename) > 96) clean_filename = substr(clean_filename, 0, 96);

	writefile(dir + '/source.txt',
		'type=' + (prepared.kind == 'binary' ? 'custom-upload' : 'custom-upload-archive') + '\n' +
		'label=' + clean_label + '\n' +
		'filename=' + clean_filename + '\n' +
		'archive_type=' + (prepared.kind == 'binary' ? '' : prepared.kind) + '\n' +
		'archive_sha256=' + (prepared.archive_sha256 || '') + '\n' +
		'sha256=' + actual + '\n' +
		'version=' + smoke.version + '\n'
	);
	run('chmod 600 ' + shell_quote(dir + '/source.txt'));
	cleanup();

	return {
		ok: true,
		slot: slot,
		path: target,
		version: smoke.version,
		sha256: actual,
		archive_sha256: prepared.archive_sha256 || '',
		archive_type: prepared.kind != 'binary' ? prepared.kind : '',
		archive_member: prepared.member || '',
		config_file: cfg,
		message: prepared.kind == 'binary'
			? 'Custom dae binary smoke-tested, configuration-validated and installed into an immutable slot'
			: 'Custom dae archive extracted, smoke-tested, configuration-validated and installed into an immutable slot'
	};
}

function vm_release_digest(tag, asset) {
	let api = 'https://api.github.com/repos/daeuniverse/dae/releases/tags/' + tag;
	let r = run(
		"curl --fail --location --silent --show-error --connect-timeout 8 --max-time 20 " +
		"-H 'Accept: application/vnd.github+json' -H 'User-Agent: luci-app-dae-ui' " +
		shell_quote(api)
	);
	if (r.rc != 0) return '';

	let data = parse_json_safe(r.output);
	if (type(data) != 'object') return '';
	for (let idx, item in (data.assets || [])) {
		if (!item || item.name != asset) continue;
		let d = item.digest || '';
		let m = match(d, /^sha256:([A-Fa-f0-9]{64})$/);
		return m ? m[1] : '';
	}
	return '';
}

function vm_install_release(s, tag, asset) {
	if (!match(tag || '', /^[A-Za-z0-9._-]+$/) || length(tag) > 80)
		return { ok: false, error: 'Invalid release tag' };
	if (!vm_allowed_asset(asset))
		return { ok: false, error: 'Release asset does not match this router architecture' };

	let tmp = '/tmp/dae-ui-version-' + pid() + '-' + stamp();
	let archive = tmp + '/' + asset;
	let dgst = archive + '.dgst';
	let url = 'https://github.com/daeuniverse/dae/releases/download/' + tag + '/' + asset;
	let dgst_url = url + '.dgst';

	let prep = run('mkdir -p ' + shell_quote(tmp));
	if (prep.rc != 0)
		return { ok: false, error: 'Unable to create download workspace', output: prep.output };

	let dl = run(
		'curl --fail --location --silent --show-error --retry 2 --connect-timeout 10 --max-time 180 -o ' +
		shell_quote(archive) + ' ' + shell_quote(url)
	);
	if (dl.rc != 0) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'DAE release download failed', output: dl.output };
	}

	let expected = vm_release_digest(tag, asset);
	if (!expected) {
		let sd = run(
			'curl --fail --location --silent --show-error --retry 2 --connect-timeout 10 --max-time 30 -o ' +
			shell_quote(dgst) + ' ' + shell_quote(dgst_url)
		);
		if (sd.rc != 0) {
			run('rm -rf ' + shell_quote(tmp));
			return { ok: false, error: 'No trusted SHA256 was available from GitHub metadata or the official .dgst asset; installation aborted', output: sd.output };
		}
		expected = trim(run("awk '$NF==\"sha256\" {print $1; exit}' " + shell_quote(dgst)).output);
	}

	let actual = trim(run("sha256sum " + shell_quote(archive) + " | awk '{print $1}'").output);
	if (!match(expected, /^[A-Fa-f0-9]{64}$/) || expected != actual) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Release SHA256 verification failed', expected: expected, actual: actual };
	}

	let binary_name = replace(asset, /\.zip$/, '');
	let candidate = tmp + '/dae';
	let ex = run('unzip -p ' + shell_quote(archive) + ' ' + shell_quote(binary_name) + ' > ' + shell_quote(candidate));
	if (ex.rc != 0) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Unable to extract dae binary from release archive', output: ex.output };
	}
	run('chmod 755 ' + shell_quote(candidate));

	let smoke = vm_candidate_version(candidate);
	if (!smoke.ok) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Downloaded dae binary failed the execution smoke test', output: smoke.output };
	}

	let cfg = vm_service_config(s);
	let val = validate(candidate, cfg);
	if (val.rc != 0) {
		run('rm -rf ' + shell_quote(tmp));
		return {
			ok: false,
			error: 'Downloaded dae version is incompatible with the current service configuration',
			output: val.output,
			diagnostics: validation_diagnostics(s, val.output),
			config_file: cfg
		};
	}

	let slot = replace(tag + '-' + binary_name + '-' + substr(actual, 0, 12), /[^A-Za-z0-9._-]/g, '_');
	if (!vm_safe_slot(slot)) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Unable to derive a safe version slot' };
	}

	let dir = vm_root() + '/' + slot;
	let target = dir + '/dae';
	let inst = run('mkdir -p ' + shell_quote(dir));
	if (inst.rc != 0) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Unable to create version slot', output: inst.output };
	}

	if (stat(target)) {
		let installed_sha = trim(run("sha256sum " + shell_quote(target) + " 2>/dev/null | awk '{print $1}'").output);
		if (installed_sha == actual) {
			run('rm -rf ' + shell_quote(tmp));
			return {
				ok: true,
				slot: slot,
				path: target,
				version: smoke.version,
				sha256: actual,
				config_file: cfg,
				message: 'This exact verified release is already installed'
			};
		}
	}

	let mv = run('mv -f ' + shell_quote(candidate) + ' ' + shell_quote(target) + ' && chmod 755 ' + shell_quote(target));
	if (mv.rc != 0) {
		run('rm -rf ' + shell_quote(tmp));
		return { ok: false, error: 'Unable to install dae into version slot', output: mv.output };
	}

	writefile(dir + '/source.txt',
		'tag=' + tag + '\nasset=' + asset + '\nsha256=' + actual + '\nversion=' + smoke.version + '\n'
	);
	run('chmod 600 ' + shell_quote(dir + '/source.txt'));
	run('rm -rf ' + shell_quote(tmp));

	return {
		ok: true,
		slot: slot,
		path: target,
		version: smoke.version,
		sha256: actual,
		config_file: cfg,
		message: 'Release downloaded, SHA256-verified, executed and configuration-validated'
	};
}

function vm_switch(s, slot) {
	if (!vm_safe_slot(slot))
		return { ok: false, error: 'Invalid version slot' };
	let candidate = vm_slot_path(slot);
	if (!stat(candidate))
		return { ok: false, error: 'Version slot does not exist' };

	let smoke = vm_candidate_version(candidate);
	if (!smoke.ok)
		return { ok: false, error: 'Selected dae binary is not executable on this router', output: smoke.output };

	let cfg = vm_service_config(s);
	let val = validate(candidate, cfg);
	if (val.rc != 0)
		return {
			ok: false,
			error: 'Selected dae version does not validate the active service configuration',
			output: val.output,
			diagnostics: validation_diagnostics(s, val.output),
			config_file: cfg
		};

	let previous = vm_enabled() ? vm_selected() : 'system';
	let previous_good = vm_last_good();

	let prep = run(shell_quote(vm_guard()) + ' prepare');
	if (prep.rc != 0)
		return { ok: false, error: 'Unable to install the persistent dae runner', output: prep.output };

	let en = run('/etc/init.d/dae-ui-version enable');
	if (en.rc != 0)
		return { ok: false, error: 'Unable to enable the dae version boot guard', output: en.output };

	let set = vm_set_selection(slot, previous_good, true);
	if (!set.ok)
		return { ok: false, error: 'Unable to persist selected dae version', output: set.output };

	let service_enabled = vm_service_enabled();
	let was_running = pid() > 0;
	if (!service_enabled && !was_running) {
		return {
			ok: true,
			slot: slot,
			version: smoke.version,
			config_file: cfg,
			restarted: false,
			last_good: previous_good,
			message: 'Version selected and persisted; dae service is disabled/stopped, so runtime confirmation was deferred'
		};
	}

	let rr = run(shell_quote(s.init) + ' restart');
	run('sleep 2');
	let p = pid();
	let actual = p ? trim(run('readlink -f /proc/' + p + '/exe 2>/dev/null').output) : '';
	if (rr.rc == 0 && p > 0 && actual == candidate) {
		vm_set_selection(slot, slot, true);
		return {
			ok: true,
			slot: slot,
			version: smoke.version,
			config_file: cfg,
			restarted: true,
			pid: p,
			actual_binary: actual,
			last_good: slot,
			message: 'Version activated, dae restarted successfully, and this slot is now last-good'
		};
	}

	let fallback = vm_safe_slot(previous_good) && stat(vm_slot_path(previous_good)) ? previous_good :
		(vm_safe_slot(previous) && stat(vm_slot_path(previous)) ? previous : 'system');
	vm_set_selection(fallback, fallback, true);
	run(shell_quote(vm_guard()) + ' boot');
	let rb = run(shell_quote(s.init) + ' restart');
	run('sleep 2');
	let rp = pid();

	return {
		ok: false,
		error: 'Selected dae version failed runtime restart; automatically rolled back',
		output: rr.output,
		rolled_back: true,
		fallback_slot: fallback,
		fallback_running: rb.rc == 0 && rp > 0,
		fallback_pid: rp,
		config_file: cfg
	};
}

function vm_delete(slot) {
	if (!vm_safe_slot(slot) || slot == 'system')
		return { ok: false, error: 'The system slot cannot be deleted' };
	if (slot == vm_selected() || slot == vm_last_good())
		return { ok: false, error: 'Selected or last-good slot cannot be deleted' };
	let dir = vm_root() + '/' + slot;
	if (!stat(dir))
		return { ok: false, error: 'Version slot not found' };
	let r = run('rm -rf ' + shell_quote(dir));
	return { ok: r.rc == 0, error: r.rc == 0 ? '' : 'Unable to delete version slot', output: r.output };
}

function vm_status(s) {
	let platform = vm_arch_assets();
	let p = pid();
	let actual = p ? trim(run('readlink -f /proc/' + p + '/exe 2>/dev/null').output) : '';
	let public_target = trim(run('readlink -f /usr/bin/dae 2>/dev/null').output);
	let boot_error = trim(readfile('/tmp/dae-ui-version-boot-error') || '');
	let service_cfg = vm_service_config(s);

	return {
		ok: true,
		enabled: vm_enabled(),
		selected_slot: vm_selected(),
		last_good_slot: vm_last_good(),
		root: vm_root(),
		runner: vm_runner(),
		runner_installed: public_target == vm_runner(),
		public_binary: '/usr/bin/dae',
		public_target: public_target,
		service_config_file: service_cfg,
		ui_config_file: s.config,
		config_paths_match: service_cfg == s.config,
		service_enabled: vm_service_enabled(),
		running: p > 0,
		pid: p,
		running_binary: actual,
		arch: platform.arch,
		allowed_assets: platform.assets,
		boot_error: boot_error,
		slots: vm_slots(s),
		system_external_version: !vm_enabled() && stat('/usr/bin/dae') ? version('/usr/bin/dae') : ''
	};
}

function native_api_status(s) {
	let cfg = native_api_config(s);
	let base = native_probe_url(cfg.listen);
	let token = native_token();
	let auth_configured = !!token;

	let discovery_public = http_probe(base ? base + '/api' : '', false, []);
	let discovery = discovery_public;
	if (discovery_public.status == 401 && auth_configured)
		discovery = http_probe(base + '/api', true, []);

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

	let challenged = discovery_public.status == 401 && !!match(discovery_public.headers, /WWW-Authenticate:\s*Bearer/i);
	let compatible = (discovery.status == 200 && api_major == 1) || challenged;

	let cap = http_probe(base ? base + '/api/v1/capabilities' : '', true, []);
	let cap_body = cap.status == 200 ? cap.body : '';
	let cap_data = cap.status == 200 ? parse_json_safe(cap.body) : null;
	let probe_options = probe_options_from_capabilities(cap_data);

	return {
		detected: cfg.detected,
		enabled: cfg.enabled,
		listen: cfg.listen,
		probe_base: base,
		discovery_status: discovery.status,
		discovery_public_status: discovery_public.status,
		api_major: api_major,
		name: name,
		base_path: base_path,
		auth_challenge: challenged,
		auth_configured: auth_configured,
		auth_accepted: auth_configured && cap.status == 200,
		contract_ready: compatible,
		capabilities_status: cap.status,
		probe_options: probe_options,
		resources: {
			runtime: capability_available(cap_body, 'runtime'),
			runtime_memory: capability_available(cap_body, 'runtime_memory'),
			runtime_outbounds: capability_available(cap_body, 'runtime_outbounds'),
			nodes: capability_available(cap_body, 'nodes'),
			groups: capability_available(cap_body, 'groups'),
			config: capability_available(cap_body, 'config'),
			probes: capability_available(cap_body, 'probes'),
			rules: capability_available(cap_body, 'rules'),
			operations: capability_available(cap_body, 'operations'),
			connections: capability_available(cap_body, 'connections'),
			flows: capability_available(cap_body, 'flows'),
			routing_trace: capability_available(cap_body, 'routing_trace'),
			dns_query: capability_available(cap_body, 'dns_query'),
			dns_rules: capability_available(cap_body, 'dns_rules'),
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
					validation_diagnostics: validation_diagnostics(s, vr.output),
					dae0: iface_exists('dae0'),
					dae0peer: iface_exists('dae0peer'),
					last_backup: latest_backup(s.config),
					config_files: length(config_files(s)),
					process_uptime: process_uptime(p),
					interfaces: trim(run('ip -brief link show 2>/dev/null').output),
					default_route: trim(run('ip route show default 2>/dev/null').output),
					version_manager_enabled: vm_enabled(),
					selected_slot: vm_selected(),
					last_good_slot: vm_last_good(),
					running_binary: p ? trim(run('readlink -f /proc/' + p + '/exe 2>/dev/null').output) : ''
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

				if (vm_enabled() && (action == 'start' || action == 'restart')) {
					let guard = run(shell_quote(vm_guard()) + ' prepare');
					if (guard.rc != 0)
						return { ok: false, error: 'Unable to repair the managed /usr/bin/dae runner before service action', output: guard.output };
				}

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
					return { ok: false, error: 'Validation failed; new file removed', output: v.output, diagnostics: validation_diagnostics(s, v.output), rolled_back: true };
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
					return { ok: false, error: 'Backup validation failed; current file restored', output: v.output, diagnostics: validation_diagnostics(s, v.output), rolled_back: true };
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

		refresh_geodata_pins: {
			call: function() {
				return refresh_geodata_pins();
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
					diagnostics: validation_diagnostics(s, v.output),
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


		native_api_get: {
			args: {
				resource: 'string',
				limit: 'int',
				cursor: 'string',
				type: 'string',
				src: 'string',
				network: 'string',
				state: 'string',
				group_id: 'string',
				connection_id: 'string',
				name: 'string',
				domain: 'string',
				record_type: 'string',
				include_expired: 'bool'
			},
			call: function(req) {
				return native_api_get(settings(), req.args);
			}
		},

		native_auth_status: {
			call: function() {
				return { configured: !!native_token() };
			}
		},

		set_native_token: {
			args: { token: 'string' },
			call: function(req) {
				let r = set_native_token(req.args.token || '');
				if (!r.ok) return r;
				let status = native_api_status(settings());
				r.capabilities_status = status.capabilities_status;
				r.accepted = status.capabilities_status == 200;
				return r;
			}
		},

		clear_native_token: {
			call: function() {
				return clear_native_token();
			}
		},

		version_status: {
			call: function() {
				return vm_status(settings());
			}
		},

		version_releases: {
			call: function() {
				return vm_release_list();
			}
		},

		version_download: {
			args: { tag: 'string', asset: 'string' },
			call: function(req) {
				return vm_install_release(settings(), req.args.tag || '', req.args.asset || '');
			}
		},

		version_import: {
			args: { label: 'string', filename: 'string' },
			call: function(req) {
				return vm_import_uploaded(settings(), req.args.label || '', req.args.filename || '');
			}
		},

		version_switch: {
			args: { slot: 'string' },
			call: function(req) {
				return vm_switch(settings(), req.args.slot || '');
			}
		},

		version_delete: {
			args: { slot: 'string' },
			call: function(req) {
				return vm_delete(req.args.slot || '');
			}
		},

		native_probe_start: {
			args: {
				target_type: 'string',
				target_id: 'string',
				kind: 'string',
				transport: 'string',
				ip_version: 'string',
				warmth: 'string',
				members_json: 'string'
			},
			call: function(req) {
				return native_probe_start(settings(), req.args);
			}
		},

		native_group_get: {
			args: { group_id: 'string' },
			call: function(req) {
				return native_group_get(settings(), req.args);
			}
		},

		native_flow_get: {
			args: { flow_id: 'string' },
			call: function(req) {
				return native_flow_get(settings(), req.args);
			}
		},

		native_operation_get: {
			args: { operation_id: 'string' },
			call: function(req) {
				return native_operation_get(settings(), req.args);
			}
		},

		native_dns_query: {
			args: { domain: 'string', record_types: 'string', upstream: 'string', cache_mode: 'string' },
			call: function(req) {
				return native_dns_query(settings(), req.args);
			}
		},

		native_routing_trace: {
			args: {
				domain: 'string',
				dst_ip: 'string',
				network: 'string',
				dst_port: 'int',
				src_ip: 'string',
				src_port: 'int',
				pname: 'string',
				resolve: 'string'
			},
			call: function(req) {
				return native_routing_trace(settings(), req.args);
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
