'use strict';
'require view';
'require form';
'require daeui.common as dae';

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
		return m.render().then(function(node) {
			var errors = dae.recentErrors();
			var output = E('pre', {
				'style':'white-space:pre-wrap;max-height:280px;overflow:auto'
			}, errors.length ? errors.map(dae.errorText).join('\n\n---\n\n') : _('No recent errors.'));
			var count = E('span', {}, String(errors.length));
			return E([], [
				node,
				E('div', { 'class':'cbi-section' }, [
					E('h3', {}, _('Recent error diagnostics')),
					E('div', { 'class':'cbi-map-descr' }, [
						_('Only the latest 20 in-memory errors are kept. RPC arguments, secrets and request bodies are not recorded.'),
						' ',
						_('Recorded: '), count
					]),
					output,
					E('div', { 'class':'cbi-page-actions' }, [
						E('button', { 'class':'btn cbi-button','click':function() {
							return dae.copyRecentErrors().then(function() {
								dae.notify(_('Copied recent errors to clipboard.'), 'info');
							}).catch(function() {
								dae.notify(_('No recent errors.'), 'warning');
							});
						}}, _('Copy recent errors')), ' ',
						E('button', { 'class':'btn cbi-button','click':function() {
							dae.clearRecentErrors();
							output.textContent = _('No recent errors.');
							count.textContent = '0';
							dae.notify(_('Recent errors cleared.'), 'info');
						}}, _('Clear recent errors'))
					])
				])
			]);
		});
	}
});
