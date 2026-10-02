'use strict';
'require view';
'require ui';
'require dom';
'require request';
'require rpc';
'require daeui.common as dae';

function row(k,v) {
	return E('div',{'class':'tr'},[
		E('div',{'class':'td left','style':'width:230px;font-weight:600'},k),
		E('div',{'class':'td left'},v)
	]);
}

function humanBytes(v) {
	var n=Number(v||0);
	if(!n) return '-';
	var units=['B','KiB','MiB','GiB'];
	var i=0;
	while(n>=1024&&i<units.length-1){n/=1024;i++;}
	return (i?n.toFixed(1):String(Math.round(n)))+' '+units[i];
}

function versionBadges(item,status) {
	var out=[];
	if(item.system) out.push(dae.badge(_('System fallback'),'WARN'));
	if(item.selected) out.push(dae.badge(_('Selected'),true));
	if(item.last_good) out.push(dae.badge(_('Last-good'),true));
	if(status.running_binary===item.path) out.push(dae.badge(_('Running'),true));
	return E('span',{},out);
}

function resultModal(title,res,reloadFn) {
	if(res&&res.ok) {
		ui.showModal(title,[
			E('div',{'class':'alert-message success'},res.message||_('Operation completed.')),
			res.slot?row(_('Slot'),E('code',{},res.slot)):null,
			res.version?row(_('Version'),E('code',{},res.version)):null,
			res.sha256?row(_('SHA256'),E('code',{},res.sha256)):null,
			res.archive_type?row(_('Archive type'),E('code',{},res.archive_type)):null,
			res.archive_sha256?row(_('Archive SHA256'),E('code',{},res.archive_sha256)):null,
			res.archive_member?row(_('Archive payload'),E('code',{},res.archive_member)):null,
			res.config_file?row(_('Validated config'),E('code',{},res.config_file)):null,
			res.restarted===false?E('div',{'class':'alert-message notice'},_('The service is disabled/stopped, so the selection is persisted but has not yet been runtime-confirmed.')):null,
			E('div',{'class':'right'},E('button',{
				'class':'btn cbi-button cbi-button-action',
				'click':function(){ui.hideModal();if(reloadFn)reloadFn();}
			},_('Close')))
		]);
		return;
	}

	var diagnostics=dae.diagnosticsNode(res&&res.diagnostics);
	ui.showModal(title,[
		E('div',{'class':'alert-message warning'},(res&&(res.error||res.message))||_('Operation failed.')),
		res&&res.rolled_back?E('div',{'class':'alert-message notice'},[
			_('Automatic rollback was attempted. Fallback slot: '),
			E('code',{},res.fallback_slot||'-'),
			' · ',_('fallback running: ')+(res.fallback_running?_('Yes'):_('No'))
		]):null,
		diagnostics,
		res&&res.output?E('pre',{'style':'white-space:pre-wrap;max-height:38vh;overflow:auto'},res.output):null,
		E('div',{'class':'right'},E('button',{
			'class':'btn',
			'click':function(){ui.hideModal();if(reloadFn)reloadFn();}
		},_('Close')))
	]);
}

return view.extend({
	load:function(){
		return dae.callVersionStatus();
	},

	reloadStatus:function(){
		return dae.callVersionStatus().then(function(status){
			this.status=status||{};
			var box=document.getElementById('dae-version-page');
			if(box) dom.content(box,this.renderBody(this.status));
		}.bind(this));
	},

	loadReleases:function(){
		var box=document.getElementById('dae-release-list');
		if(box) dom.content(box,E('p',{'class':'spinning'},_('Loading official dae releases from GitHub…')));
		return dae.callVersionReleases().then(function(res){
			if(!box) return;
			if(!res||!res.ok) {
				dom.content(box,E('div',{'class':'alert-message warning'},(res&&res.error)||_('Unable to load release list.')));
				return;
			}
			dom.content(box,this.releaseTable(res));
		}.bind(this));
	},

	uploadCandidateFile:function(file){
		if(!file) return Promise.resolve();

		if(file.size<1024||file.size>134217728) {
			dae.notify(_('The dae upload must be between 1 KiB and 128 MiB.'),'error');
			return Promise.resolve();
		}

		var suggested=(file.name||'custom')
			.replace(/\.(tar\.gz|tgz|zip)$/i,'')
			.replace(/^dae[-_.]?/i,'')
			.replace(/[^A-Za-z0-9._-]/g,'_')||'custom';
		var label=window.prompt(_('Optional label for this custom dae file:'),suggested);
		if(label===null) return Promise.resolve();

		if(!window.confirm(_('The uploaded file may contain an executable that will be run for a version smoke test and then used to validate the active dae configuration. Only continue with a file you trust. It will not be activated automatically.')))
			return Promise.resolve();

		var progress=E('div',{'class':'cbi-progressbar','title':'0%'},E('div',{'style':'width:0'}));
		var status=E('p',{},_('Uploading dae file…'));
		ui.showModal(_('Import custom dae file'),[status,progress,E('p',{},E('code',{},file.name||'-'))]);

		var data=new FormData();
		data.append('sessionid',rpc.getSessionID());
		data.append('filename','/tmp/dae-ui-dae-upload.bin');
		data.append('filedata',file);

		return request.post(L.env.cgi_base+'/cgi-upload',data,{
			timeout:0,
			progress:function(ev){
				if(!ev.total) return;
				var pct=(ev.loaded/ev.total)*100;
				progress.setAttribute('title',pct.toFixed(2)+'%');
				if(progress.firstElementChild)
					progress.firstElementChild.style.width=pct.toFixed(2)+'%';
			}
		}).then(function(res){
			var reply=res.json();
			if(reply&&reply.failure)
				throw new Error(reply.message||reply.failure);

			ui.showModal(_('Import custom dae file'),[
				E('p',{'class':'spinning'},[
					_('Inspecting the upload, extracting archives when needed, smoke-testing dae and validating the active service configuration…'),
					E('div',{'style':'margin-top:8px'},E('code',{},file.name||'-'))
				])
			]);

			return dae.callVersionImport(label||'',file.name||'').then(function(result){
				resultModal(_('Import custom dae file'),result,this.reloadStatus.bind(this));
			}.bind(this));
		}.bind(this)).catch(function(err){
			ui.hideModal();
			dae.notify((err&&err.message)||String(err),'error');
		});
	},

	renderUploadZone:function(){
		var self=this;
		var input=E('input',{
			'type':'file',
			'style':'display:none',
			'change':function(ev){
				var file=ev.currentTarget.files&&ev.currentTarget.files[0];
				if(file) self.uploadCandidateFile(file);
				ev.currentTarget.value='';
			}
		});

		var zone=E('div',{
			'style':'border:2px dashed var(--border-color-medium,#999);border-radius:8px;padding:22px;text-align:center;cursor:pointer;margin-top:10px',
			'click':function(){input.click();},
			'dragover':function(ev){
				ev.preventDefault();
				ev.currentTarget.style.borderStyle='solid';
			},
			'dragleave':function(ev){
				ev.currentTarget.style.borderStyle='dashed';
			},
			'drop':function(ev){
				ev.preventDefault();
				ev.currentTarget.style.borderStyle='dashed';
				var file=ev.dataTransfer&&ev.dataTransfer.files&&ev.dataTransfer.files[0];
				if(file) self.uploadCandidateFile(file);
			}
		},[
			E('div',{'style':'font-size:1.05em;font-weight:600;margin-bottom:6px'},_('Drop a dae binary or archive here')),
			E('div',{'class':'cbi-map-descr'},_('or click to choose a file')),
			E('div',{'style':'margin-top:8px'},E('code',{},_('Accepted: raw dae executable, .zip, .tar.gz, .tgz')))
		]);

		return E('div',{},[input,zone,E('div',{'class':'cbi-map-descr','style':'margin-top:8px'},_('Archives are inspected without writing their internal paths. Exactly one dae or dae-* executable must be present. Extraction is limited to 128 MiB.'))]);
	},

	installRelease:function(tag,asset){
		if(!window.confirm(_('Download and verify this official dae release? It will be installed into a version slot but will not be activated automatically.')))
			return;

		ui.showModal(_('Install dae release'),[
			E('p',{'class':'spinning'},[
				_('Downloading, verifying SHA256, smoke-testing the binary and validating the active service configuration…'),
				E('br'),E('code',{},tag+' / '+asset)
			])
		]);

		return dae.callVersionDownload(tag,asset).then(function(res){
			resultModal(_('Install dae release'),res,this.reloadStatus.bind(this));
		}.bind(this));
	},

	switchSlot:function(slot){
		if(!window.confirm(_('Activate this dae version and restart the dae service when it is currently enabled/running? The current configuration will not be modified.')))
			return;

		ui.showModal(_('Switch dae version'),[
			E('p',{'class':'spinning'},[
				_('Validating the target binary and active service configuration before switching…'),
				E('br'),E('code',{},slot)
			])
		]);

		return dae.callVersionSwitch(slot).then(function(res){
			resultModal(_('Switch dae version'),res,this.reloadStatus.bind(this));
		}.bind(this));
	},

	deleteSlot:function(slot){
		if(!window.confirm(_('Delete this inactive dae version slot?')))
			return;
		return dae.callVersionDelete(slot).then(function(res){
			if(res&&res.ok) dae.notify(_('Version slot deleted.'),'info');
			else dae.notify((res&&(res.error||res.output))||_('Unable to delete version slot.'),'error');
			return this.reloadStatus();
		}.bind(this));
	},

	releaseTable:function(res){
		var rows=[];
		(res.releases||[]).forEach(function(rel){
			(rel.assets||[]).forEach(function(asset){
				rows.push(E('tr',{'class':'tr'},[
					E('td',{'class':'td'},[
						E('strong',{},rel.tag),
						rel.prerelease?E('span',{'style':'margin-left:6px'},dae.badge(_('Prerelease'),'WARN')):null
					]),
					E('td',{'class':'td'},rel.name||rel.tag),
					E('td',{'class':'td'},E('code',{},asset.name)),
					E('td',{'class':'td'},humanBytes(asset.size)),
					E('td',{'class':'td'},asset.digest?E('code',{},asset.digest):'-'),
					E('td',{'class':'td'},E('button',{
						'class':'btn cbi-button cbi-button-action',
						'click':function(){return this.installRelease(rel.tag,asset.name);}.bind(this)
					},_('Install / Update')))
				]));
			}.bind(this));
		}.bind(this));

		return E([],[
			E('div',{'class':'cbi-map-descr'},[
				_('Router architecture: '),E('code',{},res.arch||'-'),
				' · ',_('accepted release assets: '),E('code',{},(res.allowed_assets||[]).join(', ')||'-')
			]),
			rows.length?E('div',{'class':'table'},[
				E('div',{'class':'tr table-titles'},[
					E('div',{'class':'th'},_('Tag')),
					E('div',{'class':'th'},_('Release')),
					E('div',{'class':'th'},_('Asset')),
					E('div',{'class':'th'},_('Size')),
					E('div',{'class':'th'},_('GitHub digest')),
					E('div',{'class':'th'},_('Action'))
				]),
				rows
			]):E('div',{'class':'alert-message notice'},_('No release asset matching this router architecture was returned.'))
		]);
	},

	installedTable:function(status){
		var slots=(status.slots||[]).slice();
		var rows=slots.map(function(item){
			var protectedSlot=item.system||item.selected||item.last_good;
			return E('tr',{'class':'tr'},[
				E('td',{'class':'td'},[
					E('code',{},item.slot),
					E('div',{'style':'margin-top:4px'},versionBadges(item,status))
				]),
				E('td',{'class':'td'},item.version||'-'),
				E('td',{'class':'td'},[
					E('code',{},item.source_type||'unknown'),
					item.source_label?E('div',{'class':'cbi-map-descr'},item.source_label):null
				]),
				E('td',{'class':'td'},E('code',{},item.path||'-')),
				E('td',{'class':'td'},humanBytes(item.size)),
				E('td',{'class':'td'},E('code',{},item.sha256||'-')),
				E('td',{'class':'td'},[
					item.selected?E('span',{'class':'cbi-map-descr'},_('Active selection')):E('button',{
						'class':'btn cbi-button cbi-button-action',
						'click':function(){return this.switchSlot(item.slot);}.bind(this)
					},_('Activate & Restart')),
					!protectedSlot?E('button',{
						'class':'btn cbi-button cbi-button-negative',
						'style':'margin-left:6px',
						'click':function(){return this.deleteSlot(item.slot);}.bind(this)
					},_('Delete')):null
				])
			]);
		}.bind(this));

		if(!slots.length&&!status.enabled) {
			rows.push(E('tr',{'class':'tr'},[
				E('td',{'class':'td'},E('code',{},'system')),
				E('td',{'class':'td'},status.system_external_version||'-'),
				E('td',{'class':'td'},E('code',{},'system')),
				E('td',{'class':'td'},E('code',{},'/usr/bin/dae')),
				E('td',{'class':'td'},'-'),
				E('td',{'class':'td'},'-'),
				E('td',{'class':'td'},_('Current package-managed binary; it will be captured automatically before the first managed switch.'))
			]));
		}

		return E('div',{'class':'table'},[
			E('div',{'class':'tr table-titles'},[
				E('div',{'class':'th'},_('Slot')),
				E('div',{'class':'th'},_('Version')),
				E('div',{'class':'th'},_('Source')),
				E('div',{'class':'th'},_('Path')),
				E('div',{'class':'th'},_('Size')),
				E('div',{'class':'th'},_('SHA256')),
				E('div',{'class':'th'},_('Action'))
			]),
			rows
		]);
	},

	renderBody:function(status){
		status=status||{};
		return E([],[
			E('h2',{},_('DAE Version Manager')),
			E('div',{'class':'cbi-map-descr'},_('Manage multiple dae binaries without moving or rewriting your .dae configuration. A candidate must execute and validate the active service configuration before it can be selected. Successful runtime activation becomes last-good.')),

			status.boot_error?E('div',{'class':'alert-message warning'},[
				E('strong',{},_('Boot guard warning: ')),status.boot_error
			]):null,

			!status.config_paths_match?E('div',{'class':'alert-message warning'},[
				_('The dae service and this LuCI package currently point at different configuration files. Version switching validates the service file, because that is what OpenWrt will actually start after reboot.')
			]):null,

			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Persistent selection state')),
				E('div',{'class':'table'},[
					row(_('Version manager'),dae.badge(status.enabled?_('Enabled'):_('Not enabled'),status.enabled?true:'WARN')),
					row(_('Selected slot'),E('code',{},status.selected_slot||'system')),
					row(_('Last-good slot'),E('code',{},status.last_good_slot||'system')),
					row(_('Router architecture'),E('code',{},status.arch||'-')),
					row(_('dae service enabled'),dae.badge(status.service_enabled?_('Yes'):_('No'),status.service_enabled?true:'WARN')),
					row(_('dae process'),dae.badge(status.running?_('Running'):_('Stopped'),!!status.running)),
					row(_('Running binary'),E('code',{},status.running_binary||'-')),
					row(_('Public /usr/bin/dae target'),E('code',{},status.public_target||status.public_binary||'-')),
					row(_('Managed runner installed'),dae.badge(status.runner_installed?_('Yes'):_('No'),status.runner_installed?true:'WARN')),
					row(_('Service config'),E('code',{},status.service_config_file||'-')),
					row(_('LuCI config'),E('code',{},status.ui_config_file||'-'))
				])
			]),

			E('div',{'class':'alert-message notice'},_('Reboot safety: the version boot guard starts before the normal dae init script. It validates the persisted selected binary against the service configuration, then falls back to last-good and finally the captured system binary if necessary. Configuration files are never rewritten during version selection or boot fallback.')),

			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Installed versions')),
				this.installedTable(status)
			]),

			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Import custom dae file')),
				E('div',{'class':'cbi-map-descr'},_('Upload a trusted raw dae executable or an archive containing exactly one dae executable. Supported archives are .zip, .tar.gz and .tgz. The backend extracts only the selected dae payload into a private temporary file, enforces 1 KiB–128 MiB limits, runs a version smoke test, validates the active service configuration and derives the immutable slot name from the binary SHA256. Import never activates the binary automatically.')),
				E('div',{'class':'alert-message warning'},_('Security note: validating an uploaded dae file requires executing the extracted or raw binary on the router. Import only files you trust and that match this router CPU/ABI.')),
				this.renderUploadZone()
			]),

			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Official dae releases')),
				E('div',{'class':'cbi-map-descr'},_('The release list is fetched only when requested. Downloads are restricted to daeuniverse/dae assets matching this router architecture. The .dgst SHA256 is required and verified before extraction.')),
				E('button',{
					'class':'btn cbi-button cbi-button-action',
					'click':ui.createHandlerFn(this,this.loadReleases)
				},_('Load Official Releases')),
				E('div',{'id':'dae-release-list','style':'margin-top:10px'},E('div',{'class':'alert-message notice'},_('Release list not loaded yet.')))
			])
		]);
	},

	render:function(status){
		this.status=status||{};
		return E('div',{'id':'dae-version-page'},this.renderBody(this.status));
	},

	handleSaveApply:null,
	handleSave:null,
	handleReset:null
});
