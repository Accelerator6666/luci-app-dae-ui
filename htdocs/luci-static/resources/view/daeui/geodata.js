'use strict';
'require view';
'require ui';
'require daeui.common as dae';

function fileRow(name,present,size){
	return E('div',{'class':'tr'},[
		E('div',{'class':'td left','style':'width:180px;font-weight:600'},name),
		E('div',{'class':'td left'},dae.badge(present?_('Present'):_('Missing'),!!present)),
		E('div',{'class':'td left'},present?String(size||0)+' B':'-')
	]);
}

return view.extend({
	load:function(){return dae.callGeodataStatus();},
	refreshPins:function(){
		if(!window.confirm(_('Fetch dae upstream scripts/fetch-geo-data.sh and persist only its pinned GeoData versions and SHA256 values? No GeoData file is downloaded by this step.'))) return;
		ui.showModal(_('Refresh GeoData pins'),[
			E('p',{'class':'spinning'},_('Reading pinned versions and SHA256 values from dae upstream…'))
		]);
		return dae.callRefreshGeodataPins().then(function(res){
			ui.hideModal();
			if(!res||!res.ok) {
				var msg=(res&&(res.error||res.message))||_('Unable to refresh GeoData pins.');
				if(res&&res.output) msg+='\n'+res.output;
				dae.notify(msg,'error');
				return;
			}
			dae.notify(res.message||_('GeoData pins refreshed.'),'info');
			window.setTimeout(function(){window.location.reload();},500);
		});
	},
	update:function(){
		if(!window.confirm(_('Download the currently persisted GeoData pins, verify SHA256, back up existing files and atomically replace them?'))) return;
		ui.showModal(_('GeoData Update'),[
			E('p',{'class':'spinning'},_('Downloading and verifying GeoData… This can take a little while.'))
		]);
		return dae.callUpdateGeodata().then(function(res){
			ui.hideModal();
			var msg=(res&&(res.message||res.error))||_('Operation finished.');
			if(res&&res.output) msg+='\n'+res.output;
			dae.notify(msg,res&&res.ok?'info':'error');
			if(res&&res.ok) window.setTimeout(function(){window.location.reload();},700);
		});
	},
	render:function(data){
		data=data||{};
		var loc=data.locations||[];
		var pins=data.pins||{};
		return E([],[
			E('h2',{},_('GeoData')),
			E('div',{'class':'cbi-map-descr'},_('DAE uses geoip.dat and geosite.dat for geoip/geosite routing. Updates here use the exact versions and SHA256 values pinned by dae upstream, not an unverified latest URL.')),
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('Pinned upstream versions')),
				E('div',{'class':'table'},[
					rowLine(_('geoip.dat'),pins.geoip_version||'-',pins.geoip_sha256||'-'),
					rowLine(_('geosite.dat'),pins.geosite_version||'-',pins.geosite_sha256||'-'),
					rowLine(_('Pin source'),pins.source||'builtin',pins.fetched_at||''),
					rowLine(_('Install target'),data.target||'-','')
				]),
				E('div',{'class':'alert-message notice'},[
					_('Pin refresh reads only '),E('code',{},'daeuniverse/dae/main/scripts/fetch-geo-data.sh'),
					_(' and accepts only numeric release versions plus 64-hex SHA256 values. The download URLs remain fixed to the v2fly GeoIP and domain-list-community release repositories.')
				]),
				E('div',{'class':'alert-message warning'},_('Update flow: fixed upstream pin source → persisted version/SHA256 → download to /tmp → SHA256 verify → backup existing files → atomic replace. It never uses an unverified latest/download URL.')),
				E('div',{'class':'cbi-page-actions'},[
					E('button',{'class':'btn cbi-button cbi-button-action','click':ui.createHandlerFn(this,this.refreshPins)},_('Refresh pins from dae upstream')),
					' ',
					E('button',{'class':'btn cbi-button cbi-button-apply','click':ui.createHandlerFn(this,this.update)},_('Update verified GeoData'))
				])
			]),
			E('h3',{},_('Detected locations')),
			loc.length?loc.map(function(x){
				return E('div',{'class':'cbi-section'},[
					E('h3',{},x.dir),
					E('div',{'class':'table'},[
						fileRow('geoip.dat',x.geoip,x.geoip_size),
						fileRow('geosite.dat',x.geosite,x.geosite_size)
					])
				]);
			}):E('div',{'class':'alert-message warning'},_('No geoip.dat or geosite.dat was found in the common DAE asset locations.'))
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});

function rowLine(name,value,detail){
	return E('div',{'class':'tr'},[
		E('div',{'class':'td left','style':'width:180px;font-weight:600'},name),
		E('div',{'class':'td left'},E('code',{},value)),
		E('div',{'class':'td left','style':'word-break:break-all'},detail?E('code',{},detail):'')
	]);
}
