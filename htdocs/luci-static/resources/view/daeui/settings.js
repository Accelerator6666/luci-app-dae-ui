'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m = new form.Map('dae-ui', _('DAE UI Settings'), _('Paths and integration settings for this LuCI package.'));
		var s = m.section(form.NamedSection, 'main', 'main');
		s.anonymous = true;
		var o;
		o = s.option(form.Value, 'binary', _('dae binary')); o.default = '/usr/bin/dae'; o.description = _('When DAE Version Manager is enabled, /usr/bin/dae is a persistent managed runner and this custom path is ignored by backend service actions.');
		o = s.option(form.Value, 'init', _('Init script')); o.default = '/etc/init.d/dae';
		o = s.option(form.Value, 'config_file', _('Configuration file')); o.default = '/etc/dae/config.dae';
		o = s.option(form.Value, 'log_file', _('Log file')); o.default = '/var/log/dae/dae.log';
		o = s.option(form.Value, 'dashboard_dir', _('Future dashboard directory')); o.default = '/usr/share/dae-ui/dashboard';
		return m.render();
	}
});
