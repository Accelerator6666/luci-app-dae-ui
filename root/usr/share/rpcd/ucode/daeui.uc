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

function version(bin) {
	let r = run(shell_quote(bin) + ' --version');
	if (!trim(r.output)) r = run(shell_quote(bin) + ' version');
	return trim(split(r.output || '', '\n')[0] || '');
}

function validate(bin, cfg) {
	return run(shell_quote(bin) + ' validate -c ' + shell_quote(cfg));
}

function latest_backup(cfg) {
	let r = run("ls -1t " + shell_quote(cfg + '.backup.*') + " 2>/dev/null | head -1");
	return trim(r.output);
}

function backup(cfg) {
	if (!stat(cfg)) return '';
	let stamp = trim(run("date +%Y%m%d-%H%M%S").output);
	let dst = cfg + '.backup.' + stamp;
	let r = run('cp -p ' + shell_quote(cfg) + ' ' + shell_quote(dst));
	return r.rc == 0 ? dst : '';
}

function write_atomic(path, content) {
	let tmp = path + '.new.' + pid();
	if (!writefile(tmp, content)) return { ok: false, error: 'Unable to write temporary config' };
	let r = run('chmod 600 ' + shell_quote(tmp) + ' && mv -f ' + shell_quote(tmp) + ' ' + shell_quote(path));
	return r.rc == 0 ? { ok: true } : { ok: false, error: r.output || 'Unable to replace config' };
}

function section_extract(content) {
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
					let c = substr(line, j, 1);
					if (c == '{') depth++;
					else if (c == '}') depth--;
				}
				if (depth <= 0) {
					push(out, { name: active, content: join('\n', buf) });
					active = null;
				}
			}
		} else {
			push(buf, line);
			for (let j = 0; j < length(line); j++) {
				let c = substr(line, j, 1);
				if (c == '{') depth++;
				else if (c == '}') depth--;
			}
			if (depth <= 0) {
				push(out, { name: active, content: join('\n', buf) });
				active = null;
				buf = [];
			}
		}
	}
	return out;
}

function native_api_status(cfg) {
	let content = readfile(cfg) || '';
	let has = !!match(content, /native_api\s*\{/);
	let listen = '';
	let enabled = false;
	if (has) {
		let b = match(content, /native_api\s*\{([^}]*)\}/);
		if (b) {
			let lm = match(b[1], /listen\s*:\s*['"]?([^'"\s]+)['"]?/);
			let em = match(b[1], /enabled\s*:\s*(true|false)/);
			listen = lm ? lm[1] : '';
			enabled = em ? em[1] == 'true' : true;
		}
	}
	return { detected: has, enabled: enabled, listen: listen, contract_ready: false };
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
					last_backup: latest_backup(s.config)
				};
			}
		},
		service: {
			args: { action: 'string' },
			call: function(req) {
				let s = settings();
				let action = req.args.action || '';
				let allowed = { start: true, stop: true, restart: true, reload: true, enable: true, disable: true, suspend: true };
				if (!allowed[action])
					return { ok: false, error: 'Unsupported action' };
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
				let content = req.args.content || '';
				if (!content || length(content) > 1048576) return { ok: false, error: 'Configuration is empty or too large' };
				let b = backup(s.config);
				let w = write_atomic(s.config, content);
				if (!w.ok) return w;
				let v = validate(s.binary, s.config);
				if (v.rc != 0) {
					if (b) run('cp -f ' + shell_quote(b) + ' ' + shell_quote(s.config));
					return { ok: false, error: 'Validation failed; previous configuration restored', output: v.output, rolled_back: !!b };
				}
				return { ok: true, backup: b, message: 'Configuration saved and validated' };
			}
		},
		apply_config: {
			args: { content: 'string' },
			call: function(req) {
				let s = settings();
				let content = req.args.content || '';
				if (!content || length(content) > 1048576) return { ok: false, error: 'Configuration is empty or too large' };
				let b = backup(s.config);
				let w = write_atomic(s.config, content);
				if (!w.ok) return w;
				let v = validate(s.binary, s.config);
				if (v.rc != 0) {
					if (b) run('cp -f ' + shell_quote(b) + ' ' + shell_quote(s.config));
					return { ok: false, error: 'Validation failed; previous configuration restored', output: v.output, rolled_back: !!b };
				}
				let r = run(shell_quote(s.binary) + ' reload');
				if (r.rc != 0) {
					if (b) {
						run('cp -f ' + shell_quote(b) + ' ' + shell_quote(s.config));
						run(shell_quote(s.binary) + ' reload');
					}
					return { ok: false, error: 'Reload failed; previous configuration restored', output: r.output, rolled_back: !!b };
				}
				return { ok: true, backup: b, message: 'Configuration validated and hot-reloaded' };
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
		get_sections: {
			call: function() {
				let s = settings();
				let c = readfile(s.config) || '';
				return { ok: true, sections: section_extract(c) };
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
						{ name: 'dae0 interface', state: iface_exists('dae0') ? 'PASS' : 'WARN', detail: trim(link.output) },
						{ name: 'default route', state: trim(route.output) ? 'PASS' : 'WARN', detail: trim(route.output) }
					]
				};
			}
		},
		native_api_status: {
			call: function() {
				let s = settings();
				let n = native_api_status(s.config);
				n.dashboard_exists = !!stat(s.dashboard + '/index.html');
				return n;
			}
		}
	}
};
