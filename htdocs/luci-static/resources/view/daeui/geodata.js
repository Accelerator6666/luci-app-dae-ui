'use strict';
'require view';
'require daeui.common as dae';

return view.extend({
	load:function(){ return dae.callGeodataStatus(); },
	render:function(data){
		var loc=(data&&data.locations)||[];
		return E([],[
			E('h2',{},_('GeoData')),
			E('div',{'class':'cbi-map-descr'},_('DAE uses geoip.dat and geosite.dat for geoip/geosite routing. This page detects common OpenWrt and upstream installation locations without changing or downloading files.')),
			loc.length ? loc.map(function(x){
				return E('div',{'class':'cbi-section'},[
					E('h3',{},x.dir),
					E('div',{'class':'table'},[
						E('div',{'class':'tr'},[
							E('div',{'class':'td left','style':'width:180px;font-weight:600'},'geoip.dat'),
							E('div',{'class':'td left'},dae.badge(x.geoip?_('Present'):_('Missing'),!!x.geoip)),
							E('div',{'class':'td left'},x.geoip?String(x.geoip_size||0)+' B':'-')
						]),
						E('div',{'class':'tr'},[
							E('div',{'class':'td left','style':'width:180px;font-weight:600'},'geosite.dat'),
							E('div',{'class':'td left'},dae.badge(x.geosite?_('Present'):_('Missing'),!!x.geosite)),
							E('div',{'class':'td left'},x.geosite?String(x.geosite_size||0)+' B':'-')
						])
					])
				]);
			}) : E('div',{'class':'alert-message warning'},_('No geoip.dat or geosite.dat was found in the common DAE asset locations.'))
		]);
	},
	handleSaveApply:null,handleSave:null,handleReset:null
});
